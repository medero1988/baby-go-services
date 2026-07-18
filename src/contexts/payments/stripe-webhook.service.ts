import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { PaymentService } from './payment.service';
import { StripeConnectService } from './stripe-connect.service';

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    private paymentService: PaymentService,
    private stripeConnectService: StripeConnectService,
  ) {}

  async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'payment_intent.succeeded':
      case 'payment_intent.payment_failed':
      case 'payment_intent.canceled':
        await this.handlePaymentIntentEvent(event);
        break;
      case 'account.updated':
        await this.stripeConnectService.handleAccountUpdated(event.data.object);
        break;
      case 'capability.updated': {
        const capability = event.data.object as Stripe.Capability;
        const accountId =
          typeof capability.account === 'string'
            ? capability.account
            : capability.account?.id;
        if (accountId) {
          await this.stripeConnectService.syncAccountByStripeId(accountId);
        }
        break;
      }
      default:
        this.logger.debug(`Unhandled Stripe event: ${event.type}`);
    }
  }

  private async handlePaymentIntentEvent(event: Stripe.Event): Promise<void> {
    const intent = event.data.object as Stripe.PaymentIntent;
    await this.paymentService.syncPaymentIntentStatus(intent.id, intent.status);
  }
}
