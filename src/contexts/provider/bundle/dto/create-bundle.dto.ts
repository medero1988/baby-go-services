import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ProductPriceDto } from '../../product/dto/create-product.dto';

export const MIN_BUNDLE_PRODUCTS = 2;
export const MAX_BUNDLE_PRODUCTS = 10;

/**
 * Crear bundle (Add bundle).
 * `category` se calcula en el BE: ["bundle", ...categorías de los productos].
 */
export class CreateBundleDto {
  @IsArray()
  @ArrayMinSize(MIN_BUNDLE_PRODUCTS)
  @ArrayMaxSize(MAX_BUNDLE_PRODUCTS)
  @ArrayUnique()
  @IsMongoId({ each: true })
  products: string[];

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
}
