import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from '../../provider/product/product.schema';
import { Bundle, BundleSchema } from '../../provider/bundle/bundle.schema';
import { Store, StoreSchema } from '../../provider/store/store.schema';
import { CartController } from './cart.controller';
import { Cart, CartSchema } from './cart.schema';
import { CartService } from './cart.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cart.name, schema: CartSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Bundle.name, schema: BundleSchema },
      { name: Store.name, schema: StoreSchema },
    ]),
  ],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}
