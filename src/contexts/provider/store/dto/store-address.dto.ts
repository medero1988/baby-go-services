import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class StoreAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  addressLine1: string;

  /** Indicaciones extra (piso, timbre, referencias). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressLine2?: string;

  /** Place ID de Google Places (cálculo de distancia). */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  placeId: string;
}
