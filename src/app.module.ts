import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config';
import { EnvService } from './config/env.service';
import { ClientModule } from './contexts/client/client.module';
import { ProviderModule } from './contexts/provider/provider.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forRootAsync({
      useFactory: (env: EnvService) => ({ uri: env.mongoUri }),
      inject: [EnvService],
    }),
    ClientModule,
    ProviderModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
