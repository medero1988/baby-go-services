import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AppConfig,
  AuthConfig,
  DatabaseConfig,
  EnvConfig,
  MailConfig,
  StripeConfig,
  TwilioConfig,
  CloudinaryConfig,
} from './env.types';

/**
 * Servicio para acceder a las variables de entorno de forma rápida y tipada.
 * Inyecta EnvService y usa env.port, env.mongoUri, etc.
 */
@Injectable()
export class EnvService {
  constructor(private readonly config: ConfigService) {}

  /** Configuración completa (acceso por nombres) */
  get all(): EnvConfig {
    return {
      app: this.app,
      database: this.database,
      auth: this.auth,
      mail: this.mail,
      twilio: this.twilio,
      stripe: this.stripe,
      cloudinary: this.cloudinary,
    };
  }

  /** App: port, nodeEnv */
  get app(): AppConfig {
    return this.config.getOrThrow<AppConfig>('app');
  }

  /** Database: mongoUri, mongoHost, mongoPort, mongoDatabase, etc. */
  get database(): DatabaseConfig {
    return this.config.getOrThrow<DatabaseConfig>('database');
  }

  /** Auth: JWT, Google, Facebook */
  get auth(): AuthConfig {
    return this.config.getOrThrow<AuthConfig>('auth');
  }

  /** Mail: Resend */
  get mail(): MailConfig {
    return this.config.getOrThrow<MailConfig>('mail');
  }

  /** Twilio: SMS (verificación celular) */
  get twilio(): TwilioConfig {
    return this.config.getOrThrow<TwilioConfig>('twilio');
  }

  /** Stripe: pagos plataforma + Connect */
  get stripe(): StripeConfig {
    return this.config.getOrThrow<StripeConfig>('stripe');
  }

  get cloudinary(): CloudinaryConfig {
    return this.config.getOrThrow<CloudinaryConfig>('cloudinary');
  }

  // ——— Acceso rápido (getters cortos) ———

  get port(): number {
    return this.app.port;
  }

  get nodeEnv(): string {
    return this.app.nodeEnv;
  }

  get apiToken(): string {
    return this.app.apiToken;
  }

  get mongoUri(): string {
    return this.database.mongoUri;
  }

  get mongoHost(): string {
    return this.database.mongoHost;
  }

  get mongoPort(): number {
    return this.database.mongoPort;
  }

  get mongoDatabase(): string {
    return this.database.mongoDatabase;
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get jwtSecret(): string {
    return this.auth.jwtSecret;
  }

  get jwtExpiresIn(): string {
    return this.auth.jwtExpiresIn;
  }

  get jwtRefreshExpiresIn(): string {
    return this.auth.jwtRefreshExpiresIn;
  }

  get googleClientId(): string {
    return this.auth.googleClientId;
  }

  get facebookAppId(): string {
    return this.auth.facebookAppId;
  }

  get devBypassAuth(): boolean {
    return this.auth.devBypassAuth;
  }

  get devUserEmail(): string {
    return this.auth.devUserEmail;
  }

  get devUserName(): string {
    return this.auth.devUserName;
  }

  get resendApiKey(): string {
    return this.mail.resendApiKey;
  }

  get mailFrom(): string {
    return this.mail.from;
  }

  get twilioAccountSid(): string {
    return this.twilio.accountSid;
  }

  get twilioAuthToken(): string {
    return this.twilio.authToken;
  }

  get twilioMessagingServiceSid(): string {
    return this.twilio.messagingServiceSid;
  }

  get twilioWhatsappFrom(): string {
    return this.twilio.whatsappFrom;
  }

  get cellVerificationChannel(): 'whatsapp' | 'sms' {
    return this.twilio.cellVerificationChannel;
  }

  get stripeSecretKey(): string {
    return this.stripe.secretKey;
  }

  get stripePublishableKey(): string {
    return this.stripe.publishableKey;
  }

  get stripeWebhookSecret(): string {
    return this.stripe.webhookSecret;
  }

  get stripeDefaultCurrency(): string {
    return this.stripe.defaultCurrency;
  }

  get stripePlatformFeePercent(): number {
    return this.stripe.platformFeePercent;
  }

  get stripeConnectReturnUrl(): string {
    return this.stripe.connectReturnUrl;
  }

  get stripeConnectRefreshUrl(): string {
    return this.stripe.connectRefreshUrl;
  }

  get cloudinaryCloudName(): string {
    return this.cloudinary.cloudName;
  }

  get cloudinaryApiKey(): string {
    return this.cloudinary.apiKey;
  }

  get cloudinaryApiSecret(): string {
    return this.cloudinary.apiSecret;
  }

  get isCloudinaryConfigured(): boolean {
    return Boolean(
      this.cloudinary.cloudName?.trim() &&
      this.cloudinary.apiKey?.trim() &&
      this.cloudinary.apiSecret?.trim(),
    );
  }
}
