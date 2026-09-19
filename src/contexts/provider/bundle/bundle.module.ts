import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../../../auth/auth.module';
import { ProductModule } from '../product/product.module';
import { StoreModule } from '../store/store.module';
import { BundleController } from './bundle.controller';
import { Bundle, BundleSchema } from './bundle.schema';
import { BundleService } from './bundle.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Bundle.name, schema: BundleSchema }]),
    AuthModule,
    StoreModule,
    ProductModule,
  ],
  controllers: [BundleController],
  providers: [BundleService],
  exports: [BundleService],
})
export class BundleModule {}
