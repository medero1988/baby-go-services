import { Module } from '@nestjs/common';
import { StoreModule } from './store/store.module';
import { ProductModule } from './product/product.module';
import { BundleModule } from './bundle/bundle.module';
import { ProviderController } from './provider.controller';

@Module({
  imports: [StoreModule, ProductModule, BundleModule],
  controllers: [ProviderController],
})
export class ProviderModule {}
