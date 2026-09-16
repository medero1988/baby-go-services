import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { SettingsSeeder } from './settings.seeder';
import { Settings, SettingsSchema } from './settings.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Settings.name, schema: SettingsSchema }]),
  ],
  controllers: [SettingsController],
  providers: [SettingsService, SettingsSeeder],
  exports: [SettingsService],
})
export class SettingsModule {}
