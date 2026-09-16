import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { SupportedCountry } from './settings.types';

export type SettingsDocument = Settings & Document;

@Schema({ _id: false })
export class SupportedCountrySchema implements SupportedCountry {
  @Prop({ required: true, trim: true, uppercase: true })
  code: string;

  @Prop({ required: true, trim: true })
  phoneCode: string;
}

/** Documento único de configuración global de la app (ver `SettingsSeeder`). */
@Schema({ collection: 'settings', timestamps: true })
export class Settings {
  @Prop({ type: [SupportedCountrySchema], required: true, default: [] })
  supportedCountries: SupportedCountry[];
}

export const SettingsSchema = SchemaFactory.createForClass(Settings);
