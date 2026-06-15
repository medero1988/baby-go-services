import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** Campos parciales de dirección (merge con la existente). */
export class UpdateStoreAddressDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  addressLine1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressLine2?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  placeId?: string;
}

export class UpdateStoreProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  country?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateStoreAddressDto)
  address?: UpdateStoreAddressDto;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9\s-]+$/, {
    message: 'cellPhone must be a valid phone number',
  })
  @MaxLength(20)
  cellPhone?: string;
}
