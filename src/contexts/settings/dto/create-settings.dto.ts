import {
  IsDefined,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { SettingValue } from '../settings.types';

export class CreateSettingsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Matches(/^[a-zA-Z][a-zA-Z0-9_-]*$/, {
    message:
      'code must start with a letter and use only letters, numbers, _ or -',
  })
  code: string;

  @IsDefined()
  value: SettingValue;
}
