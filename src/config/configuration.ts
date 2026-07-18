import { EnvConfig } from './env.types';

/**
 * Carga y normaliza las variables de entorno en un objeto tipado.
 * Se ejecuta al iniciar la app (ConfigModule.load).
 */
export default (): EnvConfig => {
  const port = process.env.PORT ?? '3000';
  const mongoPort = process.env.MONGODB_PORT ?? '27017';

  return {
    app: {
      port: parseInt(port, 10),
      nodeEnv: process.env.NODE_ENV ?? 'development',
    },
    database: {
      mongoUri:
        process.env.MONGO_URI ?? `mongodb://localhost:${mongoPort}/baby-go`,
      mongoHost: process.env.MONGODB_HOST ?? 'localhost',
      mongoPort: parseInt(mongoPort, 10),
      mongoDatabase: process.env.MONGODB_DATABASE ?? 'baby-go',
      mongoUsername: process.env.MONGODB_USERNAME ?? '',
      mongoPassword: process.env.MONGODB_PASSWORD ?? '',
    },
    auth: {
      jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',
      jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
      googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
      facebookAppId: process.env.FACEBOOK_APP_ID ?? '',
      devBypassAuth:
        process.env.NODE_ENV !== 'production' &&
        (process.env.ENABLE_DEV_AUTH_BYPASS === 'true' ||
          process.env.ENABLE_DEV_AUTH_BYPASS === '1'),
      devUserEmail: process.env.DEV_USER_EMAIL ?? 'dev@local.dev',
      devUserName: process.env.DEV_USER_NAME ?? 'Dev Local',
    },
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
      authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID ?? '',
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY ?? '',
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
      defaultCurrency: process.env.STRIPE_DEFAULT_CURRENCY ?? 'eur',
      platformFeePercent: parseFloat(
        process.env.STRIPE_PLATFORM_FEE_PERCENT ?? '10',
      ),
      connectReturnUrl:
        process.env.STRIPE_CONNECT_RETURN_URL ??
        `http://localhost:${port}/api/stripe-connect/return`,
      connectRefreshUrl:
        process.env.STRIPE_CONNECT_REFRESH_URL ??
        `http://localhost:${port}/api/stripe-connect/refresh`,
    },
  };
};
