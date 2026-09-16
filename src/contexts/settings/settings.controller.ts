import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { ROUTES } from '../../common/constants/api-routes.constants';
import { CreateSettingsDto } from './dto/create-settings.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

/**
 * Configuración global de la app (documento único `settings`).
 * GET es público; las escrituras requieren JWT (guard global).
 */
@Controller(`${ROUTES.COMMON}/settings`)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Public()
  getSettings() {
    return this.settingsService.find();
  }

  @Patch()
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.update(dto);
  }
}
