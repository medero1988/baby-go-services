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

export interface EnvConfig {
  app: AppConfig;
  database: DatabaseConfig;
}
