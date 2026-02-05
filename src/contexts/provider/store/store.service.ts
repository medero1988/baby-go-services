import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateStoreProfileDto } from './dto/create-store-profile.dto';
import { StoreDocument } from './store.schema';
import { StoreFunnelMeta, StoreProfileResponse } from './store.types';

export const STORE_ERRORS = {
  NAME_NOT_AVAILABLE: 'name_not_available',
  CELL_NOT_AVAILABLE: 'cell_not_available',
} as const;

@Injectable()
export class StoreService {
  constructor(
    @InjectModel('Store') private readonly storeModel: Model<StoreDocument>,
  ) {}

  async createProfile(
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
      cellValidationSent: false,
    };

    const store = await this.storeModel.create({
      name: dto.name.trim(),
      country: dto.country.trim(),
      address: dto.address.trim(),
      cellPhone: normalizedCell,
      meta,
    });

    const doc = store.toObject();
    return {
      id: String(doc._id),
      name: doc.name,
      country: doc.country,
      address: doc.address,
      cellPhone: doc.cellPhone,
      meta: doc.meta,
    };
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
