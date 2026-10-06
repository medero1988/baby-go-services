import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  ProductAttributes,
  ProviderSettableProductStatus,
} from '../product.types';

/** El provider solo puede alternar `available` ↔ `inactive`. */
export const PROVIDER_SETTABLE_PRODUCT_STATUSES: ProviderSettableProductStatus[] =
  ['available', 'inactive'];

export class UpdateProductPriceDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  list?: number;

  /** `null` quita la oferta. */
  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @IsNumber()
  @Min(0)
  offer?: number | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  activeFrom?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  activeUntil?: string;
}

/**
 * PATCH parcial. Solo se actualizan los campos enviados.
 * `attributes`: merge; mandá `null` en una key para borrarla.
 * Fotos: usar las APIs de medias.
 */
export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateProductPriceDto)
  price?: UpdateProductPriceDto;

  @IsOptional()
  @IsObject()
  attributes?: ProductAttributes;

  @IsOptional()
  @IsIn(PROVIDER_SETTABLE_PRODUCT_STATUSES)
  status?: ProviderSettableProductStatus;
}
