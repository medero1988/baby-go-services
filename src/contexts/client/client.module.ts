import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { ClientController } from './client.controller';
import { SearchModule } from './search/search.module';

@Module({
  imports: [AuthModule, SearchModule],
  controllers: [ClientController],
})
export class ClientModule {}
