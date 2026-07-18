import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import {
  AttentionSchedule,
  PickupSchedule,
  StoreAddress,
  StoreBankAccount,
  StoreFunnelMeta,
  StripeConnectStatus,
} from './store.types';

export type StoreDocument = Store & Document;

@Schema({ collection: 'stores', timestamps: true })
export class Store {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  country: string;

  @Prop({
    type: {
      addressLine1: { type: String, required: true, trim: true },
      addressLine2: { type: String, required: false, trim: true },
      placeId: { type: String, required: true, trim: true },
    },
    required: true,
  })
  address: StoreAddress;

  @Prop({ required: true, trim: true })
  cellPhone: string;

  @Prop({ trim: true })
  avatar?: string;

  /** Horario de delivery (`AttentionSchedule`); Mixed para flexibilidad de `days`. */
  @Prop({ type: MongooseSchema.Types.Mixed, required: false })
  delivery?: AttentionSchedule;

  @Prop({ type: MongooseSchema.Types.Mixed, required: false })
  customerPickup?: PickupSchedule;

  /** Stripe Connect Express (cuenta bancaria del provider). */
  @Prop({ type: MongooseSchema.Types.Mixed, required: false })
  stripeConnect?: StripeConnectStatus;

  /** Datos bancarios (payout) de la store; metadata + token Stripe. */
  @Prop({ type: MongooseSchema.Types.Mixed, required: false })
  bankAccount?: StoreBankAccount;

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
