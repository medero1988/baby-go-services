import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { SettingValue } from './settings.types';

export type SettingsDocument = Settings & Document;

@Schema({ collection: 'settings', timestamps: true })
export class Settings {
  /** Identificador estable de la config (ej. `supported-countries`). */
  @Prop({
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true,
  })
  code: string;

  /** JSON libre asociado al code. */
  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  value: SettingValue;
}

export const SettingsSchema = SchemaFactory.createForClass(Settings);
