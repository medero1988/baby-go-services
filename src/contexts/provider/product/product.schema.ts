import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import {
  ProductAttributes,
  ProductPrice,
  ProductStatus,
} from './product.types';

export type ProductDocument = Product & Document;

@Schema({ _id: true })
export class ProductMedia {
  _id?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  url: string;

  /** Cloudinary public_id (para borrar/reemplazar y armar vistas). */
  @Prop({ required: false, trim: true })
  publicId?: string;

  @Prop({ required: false })
  width?: number;

  @Prop({ required: false })
  height?: number;

  @Prop({ required: false, trim: true })
  format?: string;

  @Prop({ required: false })
  bytes?: number;
}

const ProductMediaSchema = SchemaFactory.createForClass(ProductMedia);

@Schema({ collection: 'products', timestamps: true })
export class Product {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId | string;

  @Prop({ type: Types.ObjectId, ref: 'Store', required: true, index: true })
  storeId: Types.ObjectId | string;

  @Prop({ required: true, trim: true, lowercase: true, index: true })
  category: string;

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

  /** Atributos libres enviados por el front (cualquier categoría). */
  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  attributes: ProductAttributes;

  @Prop({ type: [ProductMediaSchema], default: [] })
  medias: ProductMedia[];

  @Prop({
    required: true,
    enum: ['draft', 'active', 'inactive'],
    default: 'draft',
  })
  status: ProductStatus;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
ProductSchema.index({ storeId: 1, userId: 1 });
