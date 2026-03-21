import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { AttentionSchedule, StoreFunnelMeta } from './store.types';

export type StoreDocument = Store & Document;

@Schema({ collection: 'stores', timestamps: true })
export class Store {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  country: string;

  @Prop({ required: true, trim: true })
  address: string;

  @Prop({ required: true, trim: true })
  cellPhone: string;

  @Prop({ trim: true })
  avatar?: string;

  /** Horario de delivery (`AttentionSchedule`); Mixed para flexibilidad de `days`. */
  @Prop({ type: MongooseSchema.Types.Mixed, required: false })
  delivery?: AttentionSchedule;

  @Prop({ trim: true })
  cellVerificationCode?: string;

  @Prop()
  cellVerificationCodeExpiresAt?: Date;

  @Prop({
    type: {
      state: {
        type: String,
        enum: ['missing-info', 'pending-review', 'active'],
      },
      lastSteep: {
        type: String,
        enum: [
          'profile',
          'cell-verification',
          'avatar',
          'delivery',
          'delivery-pricing',
          'customer-pickup',
          'bank-account',
        ],
      },
      cellValidated: Boolean,
    },
    required: true,
    default: (): StoreFunnelMeta => ({
      state: 'missing-info',
      lastSteep: 'profile',
      cellValidated: false,
    }),
  })
  meta: StoreFunnelMeta;
}

export const StoreSchema = SchemaFactory.createForClass(Store);

StoreSchema.index({ userId: 1 });
StoreSchema.index({ name: 1 }, { unique: true });
StoreSchema.index({ cellPhone: 1 }, { unique: true });
