import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const HANDOFF_TYPES = [
  'delivery',
  'customer_pickup',
  'customer-pickup',
] as const;

export class CartHandoffDto {
  @IsIn(HANDOFF_TYPES)
  type: (typeof HANDOFF_TYPES)[number];

  @IsOptional()
  @IsString()
  address?: string;

  /** Minutos desde las 00:00. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  time?: number;
}

export class CartRentalPeriodDto {
  /** YYYY-MM-DD o DD/MM/YYYY */
  @IsString()
  @MinLength(1)
  start: string;

  /** YYYY-MM-DD o DD/MM/YYYY */
  @IsString()
  @MinLength(1)
  end: string;
}

export class CartProductInputDto {
  @IsString()
  @MinLength(1)
  id: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  accessories?: string[];
}

export class AddCartItemDto {
  /** Un solo producto. Usar `productIds` para cargar varios. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  productId?: string;

  /** Un solo combo. Usar `bundleIds` para cargar varios. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  bundleId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  accessories?: string[];

  /** Varios productos en la misma petición. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartProductInputDto)
  productIds?: CartProductInputDto[];

  /** Varios bundles en la misma petición. No llevan accesorios. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bundleIds?: string[];

  @IsString()
  @MinLength(1)
  city: string;

  @IsString()
  @MinLength(1)
  country: string;

  @ValidateNested()
  @Type(() => CartRentalPeriodDto)
  rentalPeriod: CartRentalPeriodDto;

  @ValidateNested()
  @Type(() => CartHandoffDto)
  acquisition: CartHandoffDto;

  @ValidateNested()
  @Type(() => CartHandoffDto)
  devolution: CartHandoffDto;
}

export class UpdateCartDto {
  /** Período de alquiler (junto con `end`). */
  @IsOptional()
  @IsString()
  start?: string;

  @IsOptional()
  @IsString()
  end?: string;

  /** Store del grupo a actualizar (junto con acquisition y devolution). */
  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CartHandoffDto)
  acquisition?: CartHandoffDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CartHandoffDto)
  devolution?: CartHandoffDto;
}

export class UpdateCartAccessoriesDto {
  @IsArray()
  @IsString({ each: true })
  accessories: string[];
}

export class RemoveCartItemsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bundleIds?: string[];
}
