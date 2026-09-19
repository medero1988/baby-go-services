import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { UpdateProductPriceDto } from '../../product/dto/update-product.dto';
import { BundleStatus } from '../bundle.types';
import { MAX_BUNDLE_PRODUCTS, MIN_BUNDLE_PRODUCTS } from './create-bundle.dto';

const BUNDLE_STATUSES: BundleStatus[] = ['draft', 'active', 'inactive'];

export class UpdateBundleDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(MIN_BUNDLE_PRODUCTS)
  @ArrayMaxSize(MAX_BUNDLE_PRODUCTS)
  @ArrayUnique()
  @IsMongoId({ each: true })
  products?: string[];

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
  @IsIn(BUNDLE_STATUSES)
  status?: BundleStatus;
}
