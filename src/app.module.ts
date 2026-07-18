import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { ConfigModule } from './config';
import { EnvService } from './config/env.service';
import { ClientModule } from './contexts/client/client.module';
import { PaymentsModule } from './contexts/payments/payments.module';
import { ProviderModule } from './contexts/provider/provider.module';
import { StripeModule } from './shared/stripe/stripe.module';
import { TwilioModule } from './shared/twilio/twilio.module';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    TwilioModule,
    StripeModule,
    PaymentsModule,
    MongooseModule.forRootAsync({
      useFactory: (env: EnvService) => ({ uri: env.mongoUri }),
      inject: [EnvService],
    }),
    ClientModule,
    ProviderModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
