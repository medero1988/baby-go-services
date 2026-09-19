import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { ROUTES } from '../../common/constants/api-routes.constants';
import { CreateSettingsDto } from './dto/create-settings.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

/**
 * Configuraciones de la app por `code` + JSON.
 * GET es público; POST/PATCH requieren JWT.
 */
@Controller(`${ROUTES.COMMON}/settings`)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Public()
  findAll() {
    return this.settingsService.findAll();
  }

  @Get('/:code')
  @Public()
  findByCode(@Param('code') code: string) {
    return this.settingsService.findByCode(code);
  }

  @Post()
  create(@Body() dto: CreateSettingsDto) {
    return this.settingsService.create(dto);
  }

  @Patch('/:code')
  update(@Param('code') code: string, @Body() dto: UpdateSettingsDto) {
    return this.settingsService.update(code, dto);
  }
}
