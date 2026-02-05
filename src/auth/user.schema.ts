import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

export type AuthProvider = 'google' | 'facebook' | 'dev';

@Schema({ collection: 'users', timestamps: true })
export class User {
  @Prop({ required: true, enum: ['google', 'facebook', 'dev'] })
  provider: AuthProvider;

  @Prop({ required: true })
  providerId: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ trim: true })
  name?: string;

  @Prop()
  picture?: string;

  /** Para uso futuro: cliente vs proveedor */
  @Prop({ default: 'client', enum: ['client', 'provider'] })
  role: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ provider: 1, providerId: 1 }, { unique: true });
UserSchema.index({ email: 1 });
