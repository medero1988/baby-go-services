import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateSettingsDto } from './dto/create-settings.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { Settings, SettingsDocument } from './settings.schema';
import { DEFAULT_SUPPORTED_COUNTRIES } from './settings.types';

export const SETTINGS_ERRORS = {
  NOT_FOUND: 'settings_not_found',
  ALREADY_EXISTS: 'settings_already_exists',
} as const;

/**
 * `Settings` es un documento único (singleton): no se identifica por id,
 * siempre se opera sobre el único registro de la colección `settings`.
 */
@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Settings.name)
    private readonly settingsModel: Model<SettingsDocument>,
  ) {}

  async find(): Promise<SettingsDocument> {
    const settings = await this.settingsModel.findOne().exec();
    if (!settings) {
      throw new NotFoundException({ error: SETTINGS_ERRORS.NOT_FOUND });
    }
    return settings;
  }

  async create(dto: CreateSettingsDto): Promise<SettingsDocument> {
    const existing = await this.settingsModel.findOne().exec();
    if (existing) {
      throw new ConflictException({ error: SETTINGS_ERRORS.ALREADY_EXISTS });
    }
    return this.settingsModel.create(dto);
  }

  async update(dto: UpdateSettingsDto): Promise<SettingsDocument> {
    const settings = await this.settingsModel
      .findOneAndUpdate({}, { $set: dto }, { new: true })
      .exec();
    if (!settings) {
      throw new NotFoundException({ error: SETTINGS_ERRORS.NOT_FOUND });
    }
    return settings;
  }

  /**
   * Upsert idempotente y a prueba de condiciones de carrera entre réplicas:
   * `setOnInsert` sólo aplica si no existe ningún documento todavía.
   */
  async seed(): Promise<void> {
    await this.settingsModel
      .updateOne(
        {},
        { $setOnInsert: { supportedCountries: DEFAULT_SUPPORTED_COUNTRIES } },
        { upsert: true },
      )
      .exec();
  }
}
