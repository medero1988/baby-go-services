import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  Matches,
  ValidateNested,
} from 'class-validator';
import { StoreAddressDto } from './store-address.dto';

export class CreateStoreProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  country: string;

  @ValidateNested()
  @Type(() => StoreAddressDto)
  address: StoreAddressDto;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9\s-]+$/, {
    message: 'cellPhone must be a valid phone number',
  })
  @MaxLength(20)
  cellPhone: string;
}
