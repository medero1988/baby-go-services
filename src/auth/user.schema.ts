import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

export type AuthProvider = 'google' | 'facebook' | 'dev' | 'local';
export type UserRole = 'client' | 'provider';

@Schema({ collection: 'users', timestamps: true })
export class User {
  @Prop({ required: true, enum: ['google', 'facebook', 'dev', 'local'] })
  provider: AuthProvider;

  /** Social: id del provider. Local: email normalizado. */
  @Prop({ required: true })
  providerId: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ trim: true })
  name?: string;

  @Prop({ trim: true })
  lastName?: string;

  @Prop()
  picture?: string;

  /** Solo cuentas local (bcrypt). */
  @Prop()
  passwordHash?: string;

  @Prop({ default: false })
  emailVerified: boolean;

  @Prop({ trim: true })
  emailVerificationCode?: string;

  @Prop()
  emailVerificationCodeExpiresAt?: Date;

  @Prop({ trim: true })
  passwordRecoveryCode?: string;

  @Prop()
  passwordRecoveryCodeExpiresAt?: Date;

  @Prop({ default: 'client', enum: ['client', 'provider'] })
  role: UserRole;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ provider: 1, providerId: 1 }, { unique: true });
UserSchema.index({ email: 1 });
UserSchema.index({ provider: 1, email: 1 });
