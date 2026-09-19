import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Injectable()
export class SettingsSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(SettingsSeeder.name);

  constructor(private readonly settingsService: SettingsService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.settingsService.seed();
    this.logger.log('Settings ready (supported-countries)');
  }
}
