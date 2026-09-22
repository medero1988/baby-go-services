import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ApiTokenGuard, JwtAuthGuard } from './auth/guards';
import { ConfigModule } from './config';
import { EnvService } from './config/env.service';
import { ClientModule } from './contexts/client/client.module';
import { PaymentsModule } from './contexts/payments/payments.module';
import { ProviderModule } from './contexts/provider/provider.module';
import { SettingsModule } from './contexts/settings/settings.module';
import { MailModule } from './shared/mail/mail.module';
import { StripeModule } from './shared/stripe/stripe.module';
import { StorageModule } from './shared/storage/storage.module';
import { TwilioModule } from './shared/twilio/twilio.module';

@Module({
  imports: [
    ConfigModule,
    // Límite global por defecto; los endpoints sensibles de auth aplican
    // límites más estrictos con @Throttle(...).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
    AuthModule,
    TwilioModule,
    MailModule,
    StripeModule,
    StorageModule,
    PaymentsModule,
    MongooseModule.forRootAsync({
      useFactory: (env: EnvService) => ({ uri: env.mongoUri }),
      inject: [EnvService],
    }),
    ClientModule,
    ProviderModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: ApiTokenGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
