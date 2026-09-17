/**
 * Tipado de la configuración de la aplicación.
 * Añade aquí nuevas variables según las que uses en .env
 */
export interface AppConfig {
  port: number;
  nodeEnv: string;
  apiToken: string;
}

export interface DatabaseConfig {
  mongoUri: string;
  mongoHost: string;
  mongoPort: number;
  mongoDatabase: string;
  mongoUsername: string;
  mongoPassword: string;
}

export interface AuthConfig {
  jwtSecret: string;
  /** Expiración del access JWT (ej. 1h, 15m). */
  jwtExpiresIn: string;
  /** Expiración del refresh token (ej. 30d). */
  jwtRefreshExpiresIn: string;
  googleClientId: string;
  facebookAppId: string;
  /** En local: si true, permite bypass de auth (usuario dev) cuando no hay token */
  devBypassAuth: boolean;
  devUserEmail: string;
  devUserName: string;
}

export interface MailConfig {
  resendApiKey: string;
  /** From verificado en Resend, ej. "Baby Go <noreply@tudominio.com>" */
  from: string;
}

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  messagingServiceSid: string;
  /**
   * Sender WhatsApp (sandbox gratis: whatsapp:+14155238886).
   * Ver: Twilio Console → Messaging → Try it out → Send a WhatsApp message.
   */
  whatsappFrom: string;
  /** Canal para OTP de celular: whatsapp (default) | sms */
  cellVerificationChannel: 'whatsapp' | 'sms';
}

/** Stripe: cuenta plataforma + Connect + webhooks. */
export interface StripeConfig {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  /** Moneda por defecto (ISO, ej. eur). */
  defaultCurrency: string;
  /** Comisión plataforma (%). El resto va al provider al transferir. */
  platformFeePercent: number;
  /** URLs de retorno onboarding Connect (deep links app). */
  connectReturnUrl: string;
  connectRefreshUrl: string;
}

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export interface EnvConfig {
  app: AppConfig;
  database: DatabaseConfig;
  auth: AuthConfig;
  mail: MailConfig;
  twilio: TwilioConfig;
  stripe: StripeConfig;
  cloudinary: CloudinaryConfig;
}
