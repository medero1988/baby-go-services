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
import {
  DEFAULT_SUPPORTED_COUNTRIES,
  SettingListResponse,
  SettingResponse,
  SUPPORTED_COUNTRIES_CODE,
} from './settings.types';

export const SETTINGS_ERRORS = {
  NOT_FOUND: 'settings_not_found',
  CODE_EXISTS: 'settings_code_exists',
} as const;

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Settings.name)
    private readonly settingsModel: Model<SettingsDocument>,
  ) {}

  async findAll(): Promise<SettingListResponse> {
    const docs = await this.settingsModel
      .find()
      .sort({ code: 1 })
      .lean()
      .exec();
    return { items: docs.map((doc) => this.toResponse(doc)) };
  }

  async findByCode(code: string): Promise<SettingResponse> {
    const doc = await this.settingsModel
      .findOne({ code: normalizeCode(code) })
      .lean()
      .exec();
    if (!doc) {
      throw new NotFoundException({ error: SETTINGS_ERRORS.NOT_FOUND });
    }
    return this.toResponse(doc);
  }

  async create(dto: CreateSettingsDto): Promise<SettingResponse> {
    const code = normalizeCode(dto.code);
    const existing = await this.settingsModel.findOne({ code }).lean().exec();
    if (existing) {
      throw new ConflictException({ error: SETTINGS_ERRORS.CODE_EXISTS });
    }

    const created = await this.settingsModel.create({
      code,
      value: dto.value,
    });
    return this.toResponse(created.toObject());
  }

  async update(code: string, dto: UpdateSettingsDto): Promise<SettingResponse> {
    const updated = await this.settingsModel
      .findOneAndUpdate(
        { code: normalizeCode(code) },
        { $set: { value: dto.value } },
        { new: true },
      )
      .lean()
      .exec();
    if (!updated) {
      throw new NotFoundException({ error: SETTINGS_ERRORS.NOT_FOUND });
    }
    return this.toResponse(updated);
  }

  /**
   * Migra el singleton viejo (supportedCountries) y asegura el code
   * `supported-countries`.
   */
  async seed(): Promise<void> {
    const legacy = await this.settingsModel
      .findOne({
        code: { $exists: false },
        supportedCountries: { $exists: true },
      })
      .lean()
      .exec();

    if (legacy) {
      const countries =
        (legacy as { supportedCountries?: unknown }).supportedCountries ??
        DEFAULT_SUPPORTED_COUNTRIES;
      await this.settingsModel.updateOne(
        { code: SUPPORTED_COUNTRIES_CODE },
        {
          $setOnInsert: {
            code: SUPPORTED_COUNTRIES_CODE,
            value: countries,
          },
        },
        { upsert: true },
      );
      await this.settingsModel.deleteOne({ _id: legacy._id }).exec();
    }

    await this.settingsModel
      .updateOne(
        { code: SUPPORTED_COUNTRIES_CODE },
        {
          $setOnInsert: {
            code: SUPPORTED_COUNTRIES_CODE,
            value: DEFAULT_SUPPORTED_COUNTRIES,
          },
        },
        { upsert: true },
      )
      .exec();
  }

  private toResponse(doc: {
    _id: unknown;
    code: string;
    value: SettingResponse['value'];
    createdAt?: Date;
    updatedAt?: Date;
  }): SettingResponse {
    return {
      id: String(doc._id),
      code: doc.code,
      value: doc.value,
      createdAt: doc.createdAt?.toISOString?.(),
      updatedAt: doc.updatedAt?.toISOString?.(),
    };
  }
}

function normalizeCode(code: string): string {
  return code.trim().toLowerCase();
}
