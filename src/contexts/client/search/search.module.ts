import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Bundle, BundleSchema } from '../../provider/bundle/bundle.schema';
import { Product, ProductSchema } from '../../provider/product/product.schema';
import { Store, StoreSchema } from '../../provider/store/store.schema';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Bundle.name, schema: BundleSchema },
      { name: Store.name, schema: StoreSchema },
    ]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
