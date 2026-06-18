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
import { UpdateCustomerPickupDto } from './dto/update-customer-pickup.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';
import { UpdateDeliveryPricingDto } from './dto/update-delivery-pricing.dto';
import {
  UpdateStoreAddressDto,
  UpdateStoreProfileDto,
} from './dto/update-store-profile.dto';
import { StoreDocument } from './store.schema';
import {
  AttentionSchedule,
  DeliveryDayKey,
  DeliveryDaysMap,
  PickupSchedule,
  ServiceSchedule,
  StoreAddress,
  StoreFunnelMeta,
  StoreProfileResponse,
} from './store.types';
import { StoreAddressDto } from './dto/store-address.dto';

export const STORE_ERRORS = {
  NAME_NOT_AVAILABLE: 'name_not_available',
  CELL_NOT_AVAILABLE: 'cell_not_available',
  INVALID_CODE: 'invalid_code',
  CODE_EXPIRED: 'code_expired',
  INVALID_DELIVERY_SCHEDULE: 'invalid_delivery_schedule',
  INVALID_PICKUP_SCHEDULE: 'invalid_pickup_schedule',
  DELIVERY_NOT_CONFIGURED: 'delivery_not_configured',
  NO_FIELDS_TO_UPDATE: 'no_fields_to_update',
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
const MAX_DELIVERY_INTERVALS_PER_DAY = 3;
const MAX_PICKUP_INTERVALS_PER_DAY = 2;

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
    const normalizedCell = dto.cellPhone.replace(/\s/g, '').trim();

    await this.assertNameAvailable(dto.name.trim());
    await this.assertCellAvailable(normalizedCell);

    const meta: StoreFunnelMeta = {
      state: 'missing-info',
      lastSteep: 'profile',
      cellValidated: false,
    };

    const store = await this.storeModel.create({
      userId,
      name: dto.name.trim(),
      country: dto.country.trim(),
      address: normalizeStoreAddress(dto.address),
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

  /** Actualiza parcialmente el perfil de la store. */
  async updateProfile(
    storeId: string,
    userId: string,
    dto: UpdateStoreProfileDto,
  ): Promise<StoreProfileResponse> {
    const store = await this.storeModel
      .findOne({ _id: storeId, userId })
      .exec();
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const $set: Record<string, unknown> = {};
    let cellChanged = false;

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      await this.assertNameAvailable(trimmedName, storeId);
      $set.name = trimmedName;
    }

    if (dto.country !== undefined) {
      $set.country = dto.country.trim();
    }

    if (dto.address !== undefined) {
      $set.address = mergeStoreAddress(store.address, dto.address);
    }

    if (dto.cellPhone !== undefined) {
      const normalizedCell = dto.cellPhone.replace(/\s/g, '').trim();
      await this.assertCellAvailable(normalizedCell, storeId);
      if (normalizedCell !== store.cellPhone) {
        cellChanged = true;
      }
      $set.cellPhone = normalizedCell;
    }

    if (Object.keys($set).length === 0) {
      throw new BadRequestException({
        error: STORE_ERRORS.NO_FIELDS_TO_UPDATE,
      });
    }

    $set['meta.lastSteep'] = 'profile';
    if (cellChanged) {
      $set['meta.cellValidated'] = false;
    }

    const updated = await this.storeModel
      .findOneAndUpdate({ _id: storeId, userId }, { $set }, { new: true })
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException('Store not found');
    }

    return this.toStoreResponse(updated as StoreDocument);
  }

  private async assertNameAvailable(
    name: string,
    excludeStoreId?: string,
  ): Promise<void> {
    const normalizedName = name.toLowerCase();
    const query: Record<string, unknown> = {
      name: new RegExp(`^${escapeRegex(normalizedName)}$`, 'i'),
    };
    if (excludeStoreId) {
      query._id = { $ne: excludeStoreId };
    }
    const existing = await this.storeModel.findOne(query).lean().exec();
    if (existing) {
      throw new BadRequestException({
        error: STORE_ERRORS.NAME_NOT_AVAILABLE,
      });
    }
  }

  private async assertCellAvailable(
    cellPhone: string,
    excludeStoreId?: string,
  ): Promise<void> {
    const query: Record<string, unknown> = {
      cellPhone: new RegExp(`^${escapeRegex(cellPhone)}$`),
    };
    if (excludeStoreId) {
      query._id = { $ne: excludeStoreId };
    }
    const existing = await this.storeModel.findOne(query).lean().exec();
    if (existing) {
      throw new BadRequestException({
        error: STORE_ERRORS.CELL_NOT_AVAILABLE,
      });
    }
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

  /** Devuelve el perfil de una tienda por id (solo si pertenece al usuario). */
  async findOneById(
    storeId: string,
    userId: string,
  ): Promise<StoreProfileResponse> {
    const store = await this.storeModel
      .findOne({ _id: storeId, userId })
      .lean()
      .exec();
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    return this.toStoreResponse(store as StoreDocument);
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
    const store = await this.storeModel
      .findOne({ _id: storeId, userId })
      .lean()
      .exec();
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const schedule = this.buildAttentionScheduleFromDto(dto);
    const delivery = preserveDeliveryPricing(schedule, store.delivery);

    const updated = await this.storeModel
      .findOneAndUpdate(
        { _id: storeId, userId },
        {
          $set: {
            delivery,
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

  /** Configura tarifas de delivery (paso `delivery-pricing`). */
  async updateDeliveryPricing(
    storeId: string,
    userId: string,
    dto: UpdateDeliveryPricingDto,
  ): Promise<StoreProfileResponse> {
    const store = await this.storeModel
      .findOne({ _id: storeId, userId })
      .lean()
      .exec();
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    if (!store.delivery) {
      throw new BadRequestException({
        error: STORE_ERRORS.DELIVERY_NOT_CONFIGURED,
      });
    }

    const delivery: AttentionSchedule = {
      ...store.delivery,
      basePrice: dto.basePrice,
      pricePerKm: dto.priceKm,
      maxDeliveryDistance: dto.maxDeliveryDistance,
    };

    const updated = await this.storeModel
      .findOneAndUpdate(
        { _id: storeId, userId },
        {
          $set: {
            delivery,
            'meta.lastSteep': 'delivery-pricing',
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

  /** Configura horario de customer pickup (paso `customer-pickup`). */
  async updateCustomerPickup(
    storeId: string,
    userId: string,
    dto: UpdateCustomerPickupDto,
  ): Promise<StoreProfileResponse> {
    const customerPickup = this.buildCustomerPickupFromDto(dto);

    const updated = await this.storeModel
      .findOneAndUpdate(
        { _id: storeId, userId },
        {
          $set: {
            customerPickup,
            'meta.lastSteep': 'customer-pickup',
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
    return this.buildServiceScheduleFromDto(dto, {
      maxIntervalsPerDay: MAX_DELIVERY_INTERVALS_PER_DAY,
      invalidError: STORE_ERRORS.INVALID_DELIVERY_SCHEDULE,
      emptyScheduleMessage:
        'When delivery is available and not 24/7, timeRanges must not be empty',
    });
  }

  private buildCustomerPickupFromDto(
    dto: UpdateCustomerPickupDto,
  ): PickupSchedule {
    return this.buildServiceScheduleFromDto(dto, {
      maxIntervalsPerDay: MAX_PICKUP_INTERVALS_PER_DAY,
      invalidError: STORE_ERRORS.INVALID_PICKUP_SCHEDULE,
      emptyScheduleMessage:
        'When customer pickup is available and not 24/7, timeRanges must not be empty',
    });
  }

  private buildServiceScheduleFromDto(
    dto: {
      available: boolean;
      available24h?: boolean;
      timeRanges?: string[];
      days?: Partial<Record<DeliveryDayKey, number[]>>;
    },
    config: {
      maxIntervalsPerDay: number;
      invalidError: string;
      emptyScheduleMessage: string;
    },
  ): ServiceSchedule {
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
    const days = this.normalizeScheduleDays(dto.days);

    if (dto.available && timeRanges.length === 0) {
      throw new BadRequestException({
        error: config.invalidError,
        message: config.emptyScheduleMessage,
      });
    }

    this.validateScheduleDayIndices(timeRanges.length, days, config);

    return {
      available: dto.available,
      timeRanges,
      days: days && Object.keys(days).length > 0 ? days : undefined,
    };
  }

  private normalizeScheduleDays(
    raw?: Partial<Record<DeliveryDayKey, number[]>>,
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

  private validateScheduleDayIndices(
    timeRangeCount: number,
    days: DeliveryDaysMap | undefined,
    config: { maxIntervalsPerDay: number; invalidError: string },
  ): void {
    if (!days || timeRangeCount === 0) return;

    for (const key of DELIVERY_DAY_KEYS) {
      const indices = days[key];
      if (!indices?.length) continue;

      if (indices.length > config.maxIntervalsPerDay) {
        throw new BadRequestException({
          error: config.invalidError,
          message: `Maximum ${config.maxIntervalsPerDay} time intervals per day (${key})`,
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
            error: config.invalidError,
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
      address: StoreAddress;
      cellPhone: string;
      avatar?: string;
      delivery?: AttentionSchedule;
      customerPickup?: PickupSchedule;
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
      customerPickup: doc.customerPickup,
      meta: doc.meta,
    };
    if (devCode !== undefined) {
      res.devCode = devCode;
    }
    return res;
  }
}

function preserveDeliveryPricing(
  schedule: AttentionSchedule,
  existing?: AttentionSchedule,
): AttentionSchedule {
  if (!existing) return schedule;
  const pricing: Partial<AttentionSchedule> = {};
  if (existing.basePrice !== undefined) {
    pricing.basePrice = existing.basePrice;
  }
  if (existing.pricePerKm !== undefined) {
    pricing.pricePerKm = existing.pricePerKm;
  }
  if (existing.maxDeliveryDistance !== undefined) {
    pricing.maxDeliveryDistance = existing.maxDeliveryDistance;
  }
  return { ...schedule, ...pricing };
}

function normalizeStoreAddress(dto: StoreAddressDto): StoreAddress {
  const address: StoreAddress = {
    addressLine1: dto.addressLine1.trim(),
    placeId: dto.placeId.trim(),
  };
  const line2 = dto.addressLine2?.trim();
  if (line2) {
    address.addressLine2 = line2;
  }
  return address;
}

function mergeStoreAddress(
  current: StoreAddress,
  patch: UpdateStoreAddressDto,
): StoreAddress {
  const merged: StoreAddress = {
    addressLine1: patch.addressLine1?.trim() ?? current.addressLine1,
    placeId: patch.placeId?.trim() ?? current.placeId,
  };

  if (patch.addressLine2 !== undefined) {
    const line2 = patch.addressLine2.trim();
    if (line2) {
      merged.addressLine2 = line2;
    }
  } else if (current.addressLine2) {
    merged.addressLine2 = current.addressLine2;
  }

  return merged;
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
