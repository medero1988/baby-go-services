import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { OAuth2Client } from 'google-auth-library';
import { Model } from 'mongoose';
import { EnvService } from '../config/env.service';
import { User, UserDocument } from './user.schema';

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
  user: {
    id: string;
    email: string;
    name?: string;
    picture?: string;
    provider: string;
    role: string;
  };
}

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client | null = null;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private env: EnvService,
  ) {
    if (this.env.googleClientId) {
      this.googleClient = new OAuth2Client(this.env.googleClientId);
    }
  }

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
    const info: SocialUserInfo = {
      provider: 'google',
      providerId: payload.sub,
      email: payload.email,
      name: payload.name ?? undefined,
      picture: payload.picture ?? undefined,
    };
    return this.findOrCreateAndSign(info);
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
    const info: SocialUserInfo = {
      provider: 'facebook',
      providerId: data.id,
      email: data.email ?? `${data.id}@facebook.user`,
      name: data.name ?? undefined,
      picture: data.picture?.data?.url ?? undefined,
    };
    return this.findOrCreateAndSign(info);
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
        email: info.email,
        name: info.name,
        picture: info.picture,
        role: 'client',
      });
    } else {
      const updated = await this.userModel
        .findByIdAndUpdate(
          user._id,
          {
            $set: {
              name: info.name ?? user.name,
              picture: info.picture ?? user.picture,
            },
          },
          { new: true },
        )
        .exec();
      if (updated) user = updated;
    }

    const payload = { sub: String(user._id), email: user.email };
    const signOptions: JwtSignOptions = {
      expiresIn: this.env.jwtExpiresIn as JwtSignOptions['expiresIn'],
    };
    const accessToken = this.jwtService.sign(payload, signOptions);

    return {
      accessToken,
      user: {
        id: String(user._id),
        email: user.email,
        name: user.name,
        picture: user.picture,
        provider: user.provider,
        role: user.role,
      },
    };
  }

  /**
   * Solo en desarrollo: obtiene o crea el usuario dev para bypass de auth.
   * Usar cuando ENABLE_DEV_AUTH_BYPASS=true y no hay token.
   */
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
      });
      user = created.toObject();
    }
    return user as DevUserPayload;
  }
}
