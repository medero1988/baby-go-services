import { Module } from '@nestjs/common';
import { StoreModule } from './store/store.module';
import { ProductModule } from './product/product.module';
import { ProviderController } from './provider.controller';

@Module({
  imports: [StoreModule, ProductModule],
  controllers: [ProviderController],
})
export class ProviderModule {}
