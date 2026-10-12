import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CartDocument = Cart & Document;

export type CartHandoffType = 'delivery' | 'customer_pickup';

@Schema({ _id: false })
export class CartHandoff {
  @Prop({ required: true, enum: ['delivery', 'customer_pickup'] })
  type: CartHandoffType;

  @Prop({ trim: true })
  address?: string;

  /** Minutos desde las 00:00. */
  @Prop()
  time?: number;
}

const CartHandoffSchema = SchemaFactory.createForClass(CartHandoff);

@Schema({ _id: false })
export class CartItem {
  @Prop({
    type: String,
    enum: ['product', 'bundle'],
    default: 'product',
  })
  kind: 'product' | 'bundle';

  @Prop({ type: Types.ObjectId, ref: 'Product', required: false })
  productId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Bundle', required: false })
  bundleId?: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  accessories: string[];
}

const CartItemSchema = SchemaFactory.createForClass(CartItem);

@Schema({ _id: false })
export class CartRentalPeriod {
  /** YYYY-MM-DD */
  @Prop({ required: true })
  start: string;

  /** YYYY-MM-DD */
  @Prop({ required: true })
  end: string;
}

const CartRentalPeriodSchema = SchemaFactory.createForClass(CartRentalPeriod);

@Schema({ _id: false })
export class CartStoreGroup {
  @Prop({ type: Types.ObjectId, ref: 'Store', required: true })
  storeId: Types.ObjectId;

  @Prop({ type: CartHandoffSchema, required: true })
  acquisition: CartHandoff;

  @Prop({ type: CartHandoffSchema, required: true })
  devolution: CartHandoff;

  @Prop({ type: [CartItemSchema], default: [] })
  items: CartItem[];
}

const CartStoreGroupSchema = SchemaFactory.createForClass(CartStoreGroup);

@Schema({ collection: 'carts', timestamps: true })
export class Cart {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ trim: true })
  city?: string;

  @Prop({ trim: true })
  country?: string;

  @Prop({ type: CartRentalPeriodSchema, required: false })
  rentalPeriod?: CartRentalPeriod;

  @Prop({ type: [CartStoreGroupSchema], default: [] })
  stores: CartStoreGroup[];
}

export const CartSchema = SchemaFactory.createForClass(Cart);
