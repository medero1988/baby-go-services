import { ArrayMinSize, IsArray, IsIn, IsString } from 'class-validator';
import { PRODUCT_STATUSES } from '../../provider/product/dto/list-products-query.dto';
import { ProductStatus } from '../../provider/product/product.types';

export class SetProviderProductsStatusDto {
  @IsIn(PRODUCT_STATUSES)
  status: ProductStatus;
}

export class ApproveProductsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  productIds: string[];
}
