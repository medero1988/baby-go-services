/**
 * Tipado de la configuración de la aplicación.
 * Añade aquí nuevas variables según las que uses en .env
 */
export interface AppConfig {
  port: number;
  nodeEnv: string;
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
  jwtExpiresIn: string;
  googleClientId: string;
  facebookAppId: string;
  /** En local: si true, permite bypass de auth (usuario dev) cuando no hay token */
  devBypassAuth: boolean;
  devUserEmail: string;
  devUserName: string;
}

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  messagingServiceSid: string;
}

export interface EnvConfig {
  app: AppConfig;
  database: DatabaseConfig;
  auth: AuthConfig;
  twilio: TwilioConfig;
}
