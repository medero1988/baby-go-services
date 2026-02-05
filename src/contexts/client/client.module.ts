import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { AuthController } from './auth/auth.controller';
import { ClientController } from './client.controller';

@Module({
  imports: [AuthModule],
  controllers: [ClientController, AuthController],
})
export class ClientModule {}
