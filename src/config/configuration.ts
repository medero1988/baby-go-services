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
  };
};
