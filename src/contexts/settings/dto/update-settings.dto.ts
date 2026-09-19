import { IsDefined } from 'class-validator';
import { SettingValue } from '../settings.types';

export class UpdateSettingsDto {
  @IsDefined()
  value: SettingValue;
}
