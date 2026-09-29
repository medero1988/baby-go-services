import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ProductPrice } from '../product/product.types';
import { BundleStatus } from './bundle.types';

export type BundleDocument = Bundle & Document;

@Schema({ collection: 'bundles', timestamps: true })
export class Bundle {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId | string;

  @Prop({ type: Types.ObjectId, ref: 'Store', required: true, index: true })
  storeId: Types.ObjectId | string;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Product' }],
    required: true,
    default: [],
  })
  productIds: Types.ObjectId[];

  @Prop({ required: true, trim: true, maxlength: 200 })
  title: string;

  @Prop({ required: true, trim: true, maxlength: 2000 })
  description: string;

  @Prop({
    type: {
      list: { type: Number, required: true },
      offer: { type: Number, required: false },
      activeFrom: { type: String, required: false },
      activeUntil: { type: String, required: false },
    },
    required: true,
  })
  price: ProductPrice;

  @Prop({ type: [String], default: ['bundle'], index: true })
  category: string[];

  @Prop({
    type: String,
    required: true,
    enum: ['draft', 'active', 'inactive'],
    default: 'draft',
  })
  status: BundleStatus;
}

export const BundleSchema = SchemaFactory.createForClass(Bundle);
BundleSchema.index({ userId: 1, title: 1 });
BundleSchema.index({ storeId: 1, userId: 1 });
