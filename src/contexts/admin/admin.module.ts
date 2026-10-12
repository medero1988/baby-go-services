import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Bundle, BundleSchema } from '../provider/bundle/bundle.schema';
import { Product, ProductSchema } from '../provider/product/product.schema';
import { Store, StoreSchema } from '../provider/store/store.schema';
import { AdminApiKeyGuard } from './admin-api-key.guard';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Bundle.name, schema: BundleSchema },
      { name: Store.name, schema: StoreSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminApiKeyGuard],
})
export class AdminModule {}
