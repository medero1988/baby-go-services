import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  PRODUCT_CATEGORIES,
  ProductCategory,
  ProductStatus,
} from '../product.types';

export const PRODUCT_STATUSES: ProductStatus[] = [
  'available',
  'rented',
  'in_review',
  'inactive',
];

export class ListProductsQueryDto {
  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: ProductStatus;

  @IsOptional()
  @IsIn(PRODUCT_CATEGORIES)
  category?: ProductCategory;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
