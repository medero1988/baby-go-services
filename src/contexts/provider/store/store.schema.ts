import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { StoreFunnelMeta } from './store.types';

export type StoreDocument = Store & Document;

@Schema({ collection: 'stores', timestamps: true })
export class Store {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  country: string;

  @Prop({ required: true, trim: true })
  address: string;

  @Prop({ required: true, trim: true })
  cellPhone: string;

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
      cellValidationSent: Boolean,
    },
    required: true,
    default: (): StoreFunnelMeta => ({
      state: 'missing-info',
      lastSteep: 'profile',
      cellValidationSent: false,
    }),
  })
  meta: StoreFunnelMeta;
}

export const StoreSchema = SchemaFactory.createForClass(Store);

StoreSchema.index({ name: 1 }, { unique: true });
StoreSchema.index({ cellPhone: 1 }, { unique: true });
