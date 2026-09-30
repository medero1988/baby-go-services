import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ORDER_STATUSES, OrderStatus } from './order.types';

export type OrderDocument = Order & Document;

/**
 * Pedido (alquiler) de un cliente a una store.
 * `title` y `media` son snapshot del producto al momento del pedido, para que
 * el listado del provider sea una sola lectura de colección.
 */
@Schema({ collection: 'orders', timestamps: true })
export class Order {
  @Prop({ type: Types.ObjectId, ref: 'Store', required: true, index: true })
  storeId: Types.ObjectId | string;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId | string;

  /** Cliente que hizo el pedido. */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId | string;

  /** Número corto legible (ej. "3442"). */
  @Prop({ required: true, trim: true })
  code: string;

  /** YYYY-MM-DD */
  @Prop({ required: true, match: /^\d{4}-\d{2}-\d{2}$/ })
  startingDate: string;

  /** YYYY-MM-DD */
  @Prop({ required: true, match: /^\d{4}-\d{2}-\d{2}$/ })
  endingDate: string;

  /** HH:mm (24h) */
  @Prop({ required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ })
  timeOfReturn: string;

  /** Precio total en cents (misma convención que Payment). */
  @Prop({
    required: true,
    min: 0,
    validate: { validator: Number.isInteger, message: 'price must be cents' },
  })
  price: number;

  /** Snapshot del título del producto. */
  @Prop({ required: true, trim: true, maxlength: 200 })
  title: string;

  /** Snapshot de la primera media del producto (null si no tenía). */
  @Prop({ type: String, default: null })
  media: string | null;

  @Prop({
    type: String,
    required: true,
    enum: ORDER_STATUSES,
    default: 'pending',
  })
  status: OrderStatus;

  createdAt?: Date;

  updatedAt?: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ storeId: 1, status: 1, createdAt: -1 });
