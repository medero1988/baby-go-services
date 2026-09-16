import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { SupportedCountryDto } from './supported-country.dto';

export class CreateSettingsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SupportedCountryDto)
  supportedCountries: SupportedCountryDto[];
}
