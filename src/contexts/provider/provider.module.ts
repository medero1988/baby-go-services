import { Module } from '@nestjs/common';
import { StoreModule } from './store/store.module';
import { ProviderController } from './provider.controller';

@Module({
  imports: [StoreModule],
  controllers: [ProviderController],
})
export class ProviderModule {}
