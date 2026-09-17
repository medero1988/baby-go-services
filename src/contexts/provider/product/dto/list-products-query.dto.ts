import { IsIn, IsOptional, IsString } from 'class-validator';
import { ProductStatus } from '../product.types';

const PRODUCT_STATUSES: ProductStatus[] = ['draft', 'active', 'inactive'];

export class ListProductsQueryDto {
  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: ProductStatus;

  @IsOptional()
  @IsString()
  category?: string;
}
