import { Type } from 'class-transformer';
import {
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
import { ProductAttributes } from '../product.types';

export class ProductPriceDto {
  @IsNumber()
  @Min(0)
  list: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offer?: number;

  /** ISO date (YYYY-MM-DD) o DD/MM/YYYY. */
  @ValidateIf((o: ProductPriceDto) => o.offer !== undefined && o.offer !== null)
  @IsString()
  @IsNotEmpty()
  activeFrom?: string;

  @ValidateIf((o: ProductPriceDto) => o.offer !== undefined && o.offer !== null)
  @IsString()
  @IsNotEmpty()
  activeUntil?: string;
}

/**
 * Crear producto.
 * `attributes` es un objeto libre: el front manda lo que corresponda a la categoría.
 */
export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  category: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;

  @ValidateNested()
  @Type(() => ProductPriceDto)
  price: ProductPriceDto;

  @IsOptional()
  @IsObject()
  attributes?: ProductAttributes;
}
