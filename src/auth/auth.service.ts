import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomInt } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { Model, Types } from 'mongoose';
import { EnvService } from '../config/env.service';
import { MailService } from '../shared/mail/mail.service';
import {
  CreateAccountDto,
  EmailVerificationDto,
  LoginDto,
  NewPasswordDto,
} from './dto/local-auth.dto';
import { RefreshToken, RefreshTokenDocument } from './refresh-token.schema';
import { User, UserDocument } from './user.schema';
import { Store, StoreDocument } from '../contexts/provider/store/store.schema';

export interface SocialUserInfo {
  provider: 'google' | 'facebook' | 'dev';
  providerId: string;
  email: string;
  name?: string;
  picture?: string;
}

/** Usuario dev (lean) para adjuntar a request en bypass local */
export interface DevUserPayload {
  _id: unknown;
  email: string;
  name?: string;
  picture?: string;
  provider: string;
  providerId: string;
  role: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
    name?: string;
    lastName?: string;
    picture?: string;
    provider: string;
    role: string;
    emailVerified?: boolean;
  };
}

export interface CreateAccountResponse {
  id: string;
  name: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
  role: string;
}

export const AUTH_ERRORS = {
  EMAIL_ALREADY_REGISTERED: 'email_already_registered',
  INVALID_CREDENTIALS: 'invalid_credentials',
  EMAIL_NOT_VERIFIED: 'email_not_verified',
  INVALID_CODE: 'invalid_code',
  CODE_EXPIRED: 'code_expired',
  ACCOUNT_NOT_FOUND: 'account_not_found',
  EXPIRED_REFRESH_TOKEN: 'expired_refresh_token',
  INVALID_REFRESH_TOKEN: 'invalid_refresh_token',
} as const;

const BCRYPT_ROUNDS = 12;
const CODE_LENGTH = 6;
const CODE_EXPIRY_MINUTES = 10;

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client | null = null;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(RefreshToken.name)
    private refreshTokenModel: Model<RefreshTokenDocument>,
    @InjectModel(Store.name) private storeModel: Model<StoreDocument>,
    private jwtService: JwtService,
    private env: EnvService,
    private mail: MailService,
  ) {
    if (this.env.googleClientId) {
      this.googleClient = new OAuth2Client(this.env.googleClientId);
    }
  }

  // ——— Social ———

  async loginWithGoogle(idToken: string): Promise<AuthResult> {
    if (!this.googleClient) {
      throw new UnauthorizedException('Google login not configured');
    }
    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: this.env.googleClientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload?.email) {
      throw new UnauthorizedException('Invalid Google token');
    }
    return this.findOrCreateAndSign({
      provider: 'google',
      providerId: payload.sub,
      email: payload.email,
      name: payload.name ?? undefined,
      picture: payload.picture ?? undefined,
    });
  }

  async loginWithFacebook(accessToken: string): Promise<AuthResult> {
    const appId = this.env.facebookAppId;
    if (!appId) {
      throw new UnauthorizedException('Facebook login not configured');
    }
    const url = `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new UnauthorizedException('Invalid Facebook token');
    }
    const data = (await res.json()) as {
      id?: string;
      name?: string;
      email?: string;
      picture?: { data?: { url?: string } };
    };
    if (!data?.id) {
      throw new UnauthorizedException('Invalid Facebook token');
    }
    return this.findOrCreateAndSign({
      provider: 'facebook',
      providerId: data.id,
      email: data.email ?? `${data.id}@facebook.user`,
      name: data.name ?? undefined,
      picture: data.picture?.data?.url ?? undefined,
    });
  }

  async findOrCreateAndSign(info: SocialUserInfo): Promise<AuthResult> {
    let user = await this.userModel
      .findOne({
        provider: info.provider,
        providerId: info.providerId,
      })
      .exec();

    if (!user) {
      user = await this.userModel.create({
        provider: info.provider,
        providerId: info.providerId,
        email: info.email.toLowerCase().trim(),
        name: info.name,
        picture: info.picture,
        role: 'client',
        emailVerified: true,
      });
    } else {
      const updated = await this.userModel
        .findByIdAndUpdate(
          user._id,
          {
            $set: {
              name: info.name ?? user.name,
              picture: info.picture ?? user.picture,
              emailVerified: true,
            },
          },
          { new: true },
        )
        .exec();
      if (updated) user = updated;
    }

    return this.issueSession(user);
  }

  // ——— Local account ———

  async createAccount(dto: CreateAccountDto): Promise<CreateAccountResponse> {
    this.mail.assertConfigured();

    const email = dto.email.toLowerCase().trim();
    const existing = await this.userModel
      .findOne({ provider: 'local', email })
      .lean()
      .exec();
    if (existing) {
      throw new BadRequestException({
        error: AUTH_ERRORS.EMAIL_ALREADY_REGISTERED,
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const code = generateNumericCode(CODE_LENGTH);
    const expiresAt = addMinutes(new Date(), CODE_EXPIRY_MINUTES);

    const user = await this.userModel.create({
      provider: 'local',
      providerId: email,
      email,
      name: dto.name.trim(),
      lastName: dto.lastName.trim(),
      passwordHash,
      role: dto.role,
      emailVerified: false,
      emailVerificationCode: code,
      emailVerificationCodeExpiresAt: expiresAt,
    });

    // Si falla el mail, la cuenta ya existe: reintentar con resend-email-code.
    await this.mail.sendEmailVerification(email, code);

    return {
      id: String(user._id),
      name: user.name ?? dto.name,
      lastName: user.lastName ?? dto.lastName,
      email: user.email,
      emailVerified: false,
      role: user.role,
    };
  }

  async verifyEmail(dto: EmailVerificationDto): Promise<{ success: boolean }> {
    if (!Types.ObjectId.isValid(dto.accountId)) {
      throw new BadRequestException({ error: AUTH_ERRORS.ACCOUNT_NOT_FOUND });
    }

    const user = await this.userModel.findById(dto.accountId).exec();
    if (!user || user.provider !== 'local') {
      throw new BadRequestException({ error: AUTH_ERRORS.ACCOUNT_NOT_FOUND });
    }

    if (user.emailVerified) {
      return { success: true };
    }

    const stored = user.emailVerificationCode?.trim();
    const expiresAt = user.emailVerificationCodeExpiresAt;
    if (!stored) {
      throw new BadRequestException({ error: AUTH_ERRORS.INVALID_CODE });
    }
    if (expiresAt && new Date() > expiresAt) {
      throw new BadRequestException({ error: AUTH_ERRORS.CODE_EXPIRED });
    }
    if (stored !== dto.code.trim()) {
      throw new BadRequestException({
        error: AUTH_ERRORS.INVALID_CODE,
        success: false,
      });
    }

    await this.userModel
      .findByIdAndUpdate(user._id, {
        $set: { emailVerified: true },
        $unset: {
          emailVerificationCode: '',
          emailVerificationCodeExpiresAt: '',
        },
      })
      .exec();

    return { success: true };
  }

  async resendEmailCode(accountId: string): Promise<{ ok: true }> {
    this.mail.assertConfigured();

    if (!Types.ObjectId.isValid(accountId)) {
      throw new BadRequestException({ error: AUTH_ERRORS.ACCOUNT_NOT_FOUND });
    }
    const user = await this.userModel.findById(accountId).exec();
    if (!user || user.provider !== 'local') {
      throw new BadRequestException({ error: AUTH_ERRORS.ACCOUNT_NOT_FOUND });
    }
    if (user.emailVerified) {
      return { ok: true };
    }

    const code = generateNumericCode(CODE_LENGTH);
    const expiresAt = addMinutes(new Date(), CODE_EXPIRY_MINUTES);
    await this.userModel
      .findByIdAndUpdate(user._id, {
        $set: {
          emailVerificationCode: code,
          emailVerificationCodeExpiresAt: expiresAt,
        },
      })
      .exec();

    await this.mail.sendEmailVerification(user.email, code);
    return { ok: true };
  }

  async loginLocal(dto: LoginDto): Promise<AuthResult> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.userModel
      .findOne({ provider: 'local', email })
      .exec();
    if (!user?.passwordHash) {
      throw new UnauthorizedException({
        error: AUTH_ERRORS.INVALID_CREDENTIALS,
      });
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException({
        error: AUTH_ERRORS.INVALID_CREDENTIALS,
      });
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException({
        error: AUTH_ERRORS.EMAIL_NOT_VERIFIED,
      });
    }

    return this.issueSession(user);
  }

  // ——— Password recovery ———

  async requestPasswordRecovery(emailRaw: string): Promise<{ ok: true }> {
    this.mail.assertConfigured();

    const email = emailRaw.toLowerCase().trim();
    const user = await this.userModel
      .findOne({ provider: 'local', email })
      .exec();

    // Respuesta genérica para no filtrar existencia de email.
    if (!user) {
      return { ok: true };
    }

    const code = generateNumericCode(CODE_LENGTH);
    const expiresAt = addMinutes(new Date(), CODE_EXPIRY_MINUTES);
    await this.userModel
      .findByIdAndUpdate(user._id, {
        $set: {
          passwordRecoveryCode: code,
          passwordRecoveryCodeExpiresAt: expiresAt,
        },
      })
      .exec();

    await this.mail.sendPasswordRecovery(email, code);
    return { ok: true };
  }

  async setNewPassword(dto: NewPasswordDto): Promise<{ ok: true }> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.userModel
      .findOne({ provider: 'local', email })
      .exec();
    if (!user) {
      throw new BadRequestException({ error: AUTH_ERRORS.INVALID_CODE });
    }

    const stored = user.passwordRecoveryCode?.trim();
    const expiresAt = user.passwordRecoveryCodeExpiresAt;
    if (!stored) {
      throw new BadRequestException({ error: AUTH_ERRORS.INVALID_CODE });
    }
    if (expiresAt && new Date() > expiresAt) {
      throw new BadRequestException({ error: AUTH_ERRORS.CODE_EXPIRED });
    }
    if (stored !== dto.recoveryCode.trim()) {
      throw new BadRequestException({ error: AUTH_ERRORS.INVALID_CODE });
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.userModel
      .findByIdAndUpdate(user._id, {
        $set: { passwordHash },
        $unset: {
          passwordRecoveryCode: '',
          passwordRecoveryCodeExpiresAt: '',
        },
      })
      .exec();

    // Invalidar sesiones existentes.
    await this.refreshTokenModel
      .updateMany(
        { userId: user._id, revoked: false },
        { $set: { revoked: true } },
      )
      .exec();

    return { ok: true };
  }

  // ——— Session / refresh ———

  async refreshAccess(refreshToken: string): Promise<{
    token: string;
    refreshToken: string;
    expiresAt: string;
  }> {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.refreshTokenModel
      .findOne({ tokenHash, revoked: false })
      .exec();
    if (!stored) {
      throw new UnauthorizedException({
        error: AUTH_ERRORS.INVALID_REFRESH_TOKEN,
        reason: 'Expired refresh token',
      });
    }
    if (stored.expiresAt.getTime() <= Date.now()) {
      stored.revoked = true;
      await stored.save();
      throw new UnauthorizedException({
        error: AUTH_ERRORS.EXPIRED_REFRESH_TOKEN,
        reason: 'Expired refresh token',
      });
    }

    const user = await this.userModel.findById(stored.userId).exec();
    if (!user) {
      throw new UnauthorizedException({
        error: AUTH_ERRORS.INVALID_REFRESH_TOKEN,
        reason: 'Expired refresh token',
      });
    }

    // Rotación: invalidar el refresh usado e emitir uno nuevo.
    stored.revoked = true;
    await stored.save();

    const { accessToken, expiresAt } = this.signAccessToken(user);
    const newRefreshToken = await this.createRefreshToken(String(user._id));

    return {
      token: accessToken,
      refreshToken: newRefreshToken,
      expiresAt,
    };
  }

  async logout(userId: string, refreshToken: string): Promise<{ ok: true }> {
    const tokenHash = hashToken(refreshToken);
    await this.refreshTokenModel
      .updateOne(
        {
          userId: new Types.ObjectId(userId),
          tokenHash,
          revoked: false,
        },
        { $set: { revoked: true } },
      )
      .exec();
    return { ok: true };
  }

  /** Elimina la cuenta autenticada + refresh tokens + stores del usuario. */
  async deleteAccount(userId: string): Promise<{
    ok: true;
    deleted: { user: boolean; refreshTokens: number; stores: number };
  }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException({ error: AUTH_ERRORS.ACCOUNT_NOT_FOUND });
    }

    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new BadRequestException({ error: AUTH_ERRORS.ACCOUNT_NOT_FOUND });
    }

    return this.purgeUser(user);
  }

  /**
   * Solo no-producción: borra cuenta local por email (útil en pruebas sin login).
   */
  async deleteAccountByEmailForTests(emailRaw: string): Promise<{
    ok: true;
    deleted: { user: boolean; refreshTokens: number; stores: number };
  }> {
    if (this.env.isProduction) {
      throw new BadRequestException({ error: 'not_available_in_production' });
    }

    const email = emailRaw.toLowerCase().trim();
    const user = await this.userModel
      .findOne({ provider: 'local', email })
      .exec();
    if (!user) {
      throw new BadRequestException({ error: AUTH_ERRORS.ACCOUNT_NOT_FOUND });
    }

    return this.purgeUser(user);
  }

  private async purgeUser(user: UserDocument): Promise<{
    ok: true;
    deleted: { user: boolean; refreshTokens: number; stores: number };
  }> {
    const userId = String(user._id);

    const tokensResult = await this.refreshTokenModel
      .deleteMany({
        $or: [{ userId: user._id }, { userId: new Types.ObjectId(userId) }],
      })
      .exec();

    const storesResult = await this.storeModel
      .deleteMany({
        $expr: { $eq: [{ $toString: '$userId' }, userId] },
      })
      .exec();

    await this.userModel.deleteOne({ _id: user._id }).exec();

    return {
      ok: true,
      deleted: {
        user: true,
        refreshTokens: tokensResult.deletedCount ?? 0,
        stores: storesResult.deletedCount ?? 0,
      },
    };
  }

  async getOrCreateDevUser(): Promise<DevUserPayload | null> {
    if (this.env.isProduction || !this.env.devBypassAuth) {
      return null;
    }
    const provider = 'dev';
    const providerId = 'dev-local';
    let user = await this.userModel
      .findOne({ provider, providerId })
      .lean()
      .exec();
    if (!user) {
      const created = await this.userModel.create({
        provider,
        providerId,
        email: this.env.devUserEmail,
        name: this.env.devUserName,
        role: 'provider',
        emailVerified: true,
      });
      user = created.toObject();
    }
    return user as DevUserPayload;
  }

  private async issueSession(user: UserDocument): Promise<AuthResult> {
    const { accessToken, expiresAt } = this.signAccessToken(user);
    const refreshToken = await this.createRefreshToken(String(user._id));

    return {
      accessToken,
      refreshToken,
      expiresAt,
      user: {
        id: String(user._id),
        email: user.email,
        name: user.name,
        lastName: user.lastName,
        picture: user.picture,
        provider: user.provider,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    };
  }

  private signAccessToken(user: UserDocument): {
    accessToken: string;
    expiresAt: string;
  } {
    const payload = { sub: String(user._id), email: user.email };
    const signOptions: JwtSignOptions = {
      expiresIn: this.env.jwtExpiresIn as JwtSignOptions['expiresIn'],
    };
    const accessToken = this.jwtService.sign(payload, signOptions);
    const expiresAt = accessExpiresAtIso(this.env.jwtExpiresIn);
    return { accessToken, expiresAt };
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const raw = randomBytes(48).toString('hex');
    const tokenHash = hashToken(raw);
    const expiresAt = parseDurationToDate(this.env.jwtRefreshExpiresIn);
    await this.refreshTokenModel.create({
      userId: new Types.ObjectId(userId),
      tokenHash,
      expiresAt,
      revoked: false,
    });
    return raw;
  }
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function generateNumericCode(length: number): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += String(randomInt(0, 10));
  }
  return code;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/** Convierte "15m" | "1h" | "7d" | "30d" a Date futura. */
function parseDurationToDate(duration: string): Date {
  const match = /^(\d+)([smhd])$/i.exec(duration.trim());
  if (!match) {
    return addMinutes(new Date(), 60 * 24 * 30);
  }
  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const ms =
    unit === 's'
      ? amount * 1000
      : unit === 'm'
        ? amount * 60_000
        : unit === 'h'
          ? amount * 3_600_000
          : amount * 86_400_000;
  return new Date(Date.now() + ms);
}

function accessExpiresAtIso(duration: string): string {
  return parseDurationToDate(duration).toISOString();
}
