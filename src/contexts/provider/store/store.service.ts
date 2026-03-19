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
import { StoreDocument } from './store.schema';
import { StoreFunnelMeta, StoreProfileResponse } from './store.types';

export const STORE_ERRORS = {
  NAME_NOT_AVAILABLE: 'name_not_available',
  CELL_NOT_AVAILABLE: 'cell_not_available',
  INVALID_CODE: 'invalid_code',
  CODE_EXPIRED: 'code_expired',
} as const;

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

  private toStoreResponse(
    doc: {
      _id: unknown;
      userId: unknown;
      name: string;
      country: string;
      address: string;
      cellPhone: string;
      avatar?: string;
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
