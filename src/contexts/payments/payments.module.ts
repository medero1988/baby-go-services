import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Store, StoreSchema } from '../provider/store/store.schema';
import { Payment, PaymentSchema } from './payment.schema';
import { PaymentService } from './payment.service';
import { PaymentsController } from './payments.controller';
import { StripeConnectService } from './stripe-connect.service';
import { StripeConnectRedirectController } from './stripe-connect-redirect.controller';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Store.name, schema: StoreSchema },
    ]),
  ],
  controllers: [
    PaymentsController,
    StripeWebhookController,
    StripeConnectRedirectController,
  ],
  providers: [PaymentService, StripeConnectService, StripeWebhookService],
  exports: [PaymentService, StripeConnectService],
})
export class PaymentsModule {}
