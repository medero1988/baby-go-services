import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../../../auth/auth.module';
import { StoreModule } from '../store/store.module';
import { Bundle, BundleSchema } from '../bundle/bundle.schema';
import { ProductController } from './product.controller';
import { Product, ProductSchema } from './product.schema';
import { ProductService } from './product.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Bundle.name, schema: BundleSchema },
    ]),
    AuthModule,
    StoreModule,
  ],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
