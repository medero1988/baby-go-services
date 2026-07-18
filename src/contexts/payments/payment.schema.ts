import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PaymentStatus } from './payment.types';

export type PaymentDocument = Payment & Document;

@Schema({ collection: 'payments', timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Store', required: true, index: true })
  storeId: Types.ObjectId;

  @Prop({ trim: true, index: true })
  orderId?: string;

  @Prop({ required: true, unique: true, trim: true })
  stripePaymentIntentId: string;

  @Prop({ required: true, min: 1 })
  amount: number;

  @Prop({ required: true, min: 0 })
  providerAmount: number;

  @Prop({ required: true, min: 0 })
  platformFeeAmount: number;

  @Prop({ required: true, trim: true, lowercase: true })
  currency: string;

  @Prop({
    required: true,
    enum: [
      'requires_payment_method',
      'requires_confirmation',
      'requires_action',
      'processing',
      'succeeded',
      'failed',
      'canceled',
      'transferred',
      'refunded',
    ],
    default: 'requires_payment_method',
  })
  status: PaymentStatus;

  @Prop({ trim: true })
  stripeTransferId?: string;

  createdAt?: Date;

  updatedAt?: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

PaymentSchema.index({ userId: 1, createdAt: -1 });
PaymentSchema.index({ storeId: 1, status: 1 });
