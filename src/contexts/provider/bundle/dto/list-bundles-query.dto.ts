import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PRODUCT_STATUSES } from '../../product/dto/list-products-query.dto';
import { BundleStatus } from '../bundle.types';

export class ListBundlesQueryDto {
  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: BundleStatus;

  /** Match si el array `category` contiene este valor (`bundle`, `stroller`, …). */
  @IsOptional()
  @IsString()
  category?: string;

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
