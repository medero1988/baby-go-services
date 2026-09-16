import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { SupportedCountryDto } from './supported-country.dto';

export class UpdateSettingsDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SupportedCountryDto)
  supportedCountries?: SupportedCountryDto[];
}
