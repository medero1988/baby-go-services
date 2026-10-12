import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { CartModule } from './cart/cart.module';
import { ClientController } from './client.controller';
import { SearchModule } from './search/search.module';

@Module({
  imports: [AuthModule, SearchModule, CartModule],
  controllers: [ClientController],
})
export class ClientModule {}
