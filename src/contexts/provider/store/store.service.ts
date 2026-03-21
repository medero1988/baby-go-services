import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as path from 'path';
import { promises as fs } from 'fs';
import { EnvService } from '../../../config/env.service';
import { TwilioService } from '../../../shared/twilio/twilio.service';
import { CreateStoreProfileDto } from './dto/create-store-profile.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';
import { StoreDocument } from './store.schema';
import {
  AttentionSchedule,
  DeliveryDayKey,
  DeliveryDaysMap,
  StoreFunnelMeta,
  StoreProfileResponse,
} from './store.types';

export const STORE_ERRORS = {
  NAME_NOT_AVAILABLE: 'name_not_available',
  CELL_NOT_AVAILABLE: 'cell_not_available',
  INVALID_CODE: 'invalid_code',
  CODE_EXPIRED: 'code_expired',
  INVALID_DELIVERY_SCHEDULE: 'invalid_delivery_schedule',
} as const;

const DELIVERY_DAY_KEYS: DeliveryDayKey[] = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
];

const CODE_EXPIRY_MINUTES = 10;
const CODE_LENGTH = 6;

@Injectable()
export class StoreService {
  constructor(
    @InjectModel('Store') private readonly storeModel: Model<StoreDocument>,
    private env: EnvService,
    private twilioService: TwilioService,
  ) {}

  async createProfile(
    userId: string,
    dto: CreateStoreProfileDto,
  ): Promise<StoreProfileResponse> {
    const normalizedName = dto.name.trim().toLowerCase();
    const normalizedCell = dto.cellPhone.replace(/\s/g, '').trim();

    const existingByName = await this.storeModel
      .findOne({ name: new RegExp(`^${escapeRegex(normalizedName)}$`, 'i') })
      .lean()
      .exec();
    if (existingByName) {
      throw new BadRequestException({
        error: STORE_ERRORS.NAME_NOT_AVAILABLE,
      });
    }

    const existingByCell = await this.storeModel
      .findOne({
        cellPhone: new RegExp(`^${escapeRegex(normalizedCell)}$`),
      })
      .lean()
      .exec();
    if (existingByCell) {
      throw new BadRequestException({
        error: STORE_ERRORS.CELL_NOT_AVAILABLE,
      });
    }

    const meta: StoreFunnelMeta = {
      state: 'missing-info',
      lastSteep: 'profile',
      cellValidated: false,
    };

    const store = await this.storeModel.create({
      userId,
      name: dto.name.trim(),
      country: dto.country.trim(),
      address: dto.address.trim(),
      cellPhone: normalizedCell,
      meta,
    });

    const doc = store.toObject();
    const storeId = String(doc._id);

    // Al crear la tienda se envía el código de verificación al celular.
    const code = await this.setVerificationCodeForStore(
      storeId,
      userId,
      normalizedCell,
    );
    const devCode = this.env.isProduction ? undefined : code;
    return this.toStoreResponse(doc, devCode);
  }

  /** Envía código de verificación al celular (re-envío). En dev devuelve el código para pruebas. */
  async sendCellVerificationCode(
    storeId: string,
    userId: string,
  ): Promise<{ codeSent: boolean; devCode?: string }> {
    const store = await this.storeModel
      .findOne({ _id: storeId, userId })
      .exec();
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const code = await this.setVerificationCodeForStore(
      storeId,
      userId,
      store.cellPhone,
    );
    const result: { codeSent: boolean; devCode?: string } = { codeSent: true };
    if (!this.env.isProduction) {
      result.devCode = code;
    }
    return result;
  }

  /** Genera código, lo guarda en la tienda, envía SMS por Twilio si está configurado y devuelve el código. */
  private async setVerificationCodeForStore(
    storeId: string,
    userId: string,
    cellPhone: string,
  ): Promise<string> {
    const code = generateNumericCode(CODE_LENGTH);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + CODE_EXPIRY_MINUTES);

    await this.storeModel
      .updateOne(
        { _id: storeId, userId },
        {
          $set: {
            cellVerificationCode: code,
            cellVerificationCodeExpiresAt: expiresAt,
          },
        },
      )
      .exec();

    await this.twilioService.sendSms(cellPhone, code);
    return code;
  }

  /** Devuelve todas las tiendas. */
  async findAll(): Promise<StoreProfileResponse[]> {
    const stores = await this.storeModel.find().lean().exec();
    return stores.map((doc) => this.toStoreResponse(doc as StoreDocument));
  }

  /** Sube y guarda el avatar de la store (multipart field: `avatar`). */
  async uploadAvatar(
    storeId: string,
    userId: string,
    file: Express.Multer.File,
  ): Promise<StoreProfileResponse> {
    if (!file) {
      throw new BadRequestException({ error: 'avatar_missing' });
    }

    if (!file.buffer) {
      throw new BadRequestException({ error: 'avatar_empty' });
    }

    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException({ error: 'invalid_avatar_type' });
    }

    const ext = getAllowedImageExtension(file.mimetype);
    const uploadsDir = path.join(process.cwd(), 'uploads', 'avatars');
    await fs.mkdir(uploadsDir, { recursive: true });

    const filename = `${storeId}.${ext}`;
    const fullPath = path.join(uploadsDir, filename);

    // En este flujo esperamos `memoryStorage()` en el FileInterceptor.
    await fs.writeFile(fullPath, file.buffer);

    const avatarUrl = `/api/uploads/avatars/${filename}`;

    const updated = await this.storeModel
      .findOneAndUpdate(
        { _id: storeId, userId },
        {
          $set: {
            avatar: avatarUrl,
            'meta.lastSteep': 'avatar',
          },
        },
        { new: true },
      )
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException('Store not found');
    }

    return this.toStoreResponse(updated as StoreDocument);
  }

  async remove(storeId: string, userId: string): Promise<{ success: boolean }> {
    const store = await this.storeModel
      .findOne({ _id: storeId, userId })
      .exec();
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    // Si existe un avatar local, elimínalo al borrar la store.
    if (store.avatar) {
      const filename = path.basename(store.avatar);
      const avatarPath = path.join(
        process.cwd(),
        'uploads',
        'avatars',
        filename,
      );
      await fs.unlink(avatarPath).catch((err: unknown) => {
        const e = err as { code?: string };
        if (e.code === 'ENOENT') return;
        throw err;
      });
    }

    await this.storeModel.deleteOne({ _id: storeId, userId }).exec();
    return { success: true };
  }

  /** Valida el código y marca cellValidated en true. */
  async validateCellCode(
    storeId: string,
    userId: string,
    code: string,
  ): Promise<StoreProfileResponse> {
    const store = await this.storeModel
      .findOne({ _id: storeId, userId })
      .exec();
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const normalizedCode = code.trim().toUpperCase();
    const storedCode = store.cellVerificationCode?.trim().toUpperCase();
    const expiresAt = store.cellVerificationCodeExpiresAt;

    if (!storedCode) {
      throw new BadRequestException({ error: STORE_ERRORS.INVALID_CODE });
    }
    if (expiresAt && new Date() > expiresAt) {
      throw new BadRequestException({ error: STORE_ERRORS.CODE_EXPIRED });
    }
    if (storedCode !== normalizedCode) {
      throw new BadRequestException({ error: STORE_ERRORS.INVALID_CODE });
    }

    const updated = await this.storeModel
      .findByIdAndUpdate(
        storeId,
        {
          $set: {
            'meta.cellValidated': true,
            'meta.lastSteep': 'cell-verification',
          },
          $unset: {
            cellVerificationCode: '',
            cellVerificationCodeExpiresAt: '',
          },
        },
        { new: true },
      )
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException('Store not found');
    }
    return this.toStoreResponse(updated);
  }

  /** Configura horario de delivery (paso `delivery`). */
  async updateDelivery(
    storeId: string,
    userId: string,
    dto: UpdateDeliveryDto,
  ): Promise<StoreProfileResponse> {
    const schedule = this.buildAttentionScheduleFromDto(dto);

    const updated = await this.storeModel
      .findOneAndUpdate(
        { _id: storeId, userId },
        {
          $set: {
            delivery: schedule,
            'meta.lastSteep': 'delivery',
          },
        },
        { new: true },
      )
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException('Store not found');
    }

    return this.toStoreResponse(updated as StoreDocument);
  }

  private buildAttentionScheduleFromDto(
    dto: UpdateDeliveryDto,
  ): AttentionSchedule {
    const available24h = dto.available24h === true;

    if (available24h) {
      return {
        available: dto.available,
        available24h: true,
        timeRanges: [],
        days: {},
      };
    }

    const timeRanges = Array.isArray(dto.timeRanges) ? dto.timeRanges : [];
    const days = this.normalizeDeliveryDays(dto.days);

    if (dto.available && timeRanges.length === 0) {
      throw new BadRequestException({
        error: STORE_ERRORS.INVALID_DELIVERY_SCHEDULE,
        message:
          'When delivery is available and not 24/7, timeRanges must not be empty',
      });
    }

    this.validateDeliveryDayIndices(timeRanges.length, days);

    return {
      available: dto.available,
      timeRanges,
      days: days && Object.keys(days).length > 0 ? days : undefined,
    };
  }

  private normalizeDeliveryDays(
    raw: UpdateDeliveryDto['days'],
  ): DeliveryDaysMap | undefined {
    if (!raw) return undefined;
    const out: DeliveryDaysMap = {};
    for (const key of DELIVERY_DAY_KEYS) {
      const arr = raw[key];
      if (Array.isArray(arr) && arr.length > 0) {
        out[key] = [...arr];
      }
    }
    return Object.keys(out).length ? out : undefined;
  }

  private validateDeliveryDayIndices(
    timeRangeCount: number,
    days: DeliveryDaysMap | undefined,
  ): void {
    if (!days || timeRangeCount === 0) return;

    for (const key of DELIVERY_DAY_KEYS) {
      const indices = days[key];
      if (!indices?.length) continue;

      if (indices.length > 3) {
        throw new BadRequestException({
          error: STORE_ERRORS.INVALID_DELIVERY_SCHEDULE,
          message: `Maximum 3 time intervals per day (${key})`,
        });
      }

      for (const idx of indices) {
        if (
          typeof idx !== 'number' ||
          !Number.isInteger(idx) ||
          idx < 0 ||
          idx >= timeRangeCount
        ) {
          throw new BadRequestException({
            error: STORE_ERRORS.INVALID_DELIVERY_SCHEDULE,
            message: `Invalid timeRanges index for ${key}: ${String(idx)}`,
          });
        }
      }
    }
  }

  private toStoreResponse(
    doc: {
      _id: unknown;
      userId: unknown;
      name: string;
      country: string;
      address: string;
      cellPhone: string;
      avatar?: string;
      delivery?: AttentionSchedule;
      meta: StoreFunnelMeta;
    },
    devCode?: string,
  ): StoreProfileResponse {
    const res: StoreProfileResponse = {
      id: String(doc._id),
      userId: String(doc.userId),
      name: doc.name,
      avatar: doc.avatar,
      country: doc.country,
      address: doc.address,
      cellPhone: doc.cellPhone,
      delivery: doc.delivery,
      meta: doc.meta,
    };
    if (devCode !== undefined) {
      res.devCode = devCode;
    }
    return res;
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getAllowedImageExtension(mimetype: string): string {
  const mimeToExt: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };

  const ext = mimeToExt[mimetype];
  if (!ext) {
    throw new BadRequestException({ error: 'invalid_avatar_type' });
  }
  return ext;
}

function generateNumericCode(length: number): string {
  const digits = '0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += digits[Math.floor(Math.random() * digits.length)];
  }
  return code;
}
