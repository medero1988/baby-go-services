import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig, DatabaseConfig, EnvConfig } from './env.types';

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

  // ——— Acceso rápido (getters cortos) ———

  get port(): number {
    return this.app.port;
  }

  get nodeEnv(): string {
    return this.app.nodeEnv;
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
}
