import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SettingsService } from './settings.service';

/**
 * Corre al bootstrap de la app y crea el documento `settings` con
 * valores por defecto si todavía no existe (ver `SettingsService.seed`).
 */
@Injectable()
export class SettingsSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(SettingsSeeder.name);

  constructor(private readonly settingsService: SettingsService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.settingsService.seed();
    this.logger.log('Settings document ready');
  }
}
