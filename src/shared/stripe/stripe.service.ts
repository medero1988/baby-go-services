import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type Stripe from 'stripe';
import { EnvService } from '../../config/env.service';

// stripe usa module.exports (no default); require para compatibilidad en runtime
// eslint-disable-next-line @typescript-eslint/no-require-imports
const StripeSdk = require('stripe') as typeof Stripe;

/**
 * Wrapper del SDK de Stripe (cuenta plataforma).
 * Modelo marketplace: Separate Charges and Transfers.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private client: Stripe | null = null;

  constructor(private env: EnvService) {
    const secretKey = this.env.stripeSecretKey?.trim();
    if (secretKey) {
      this.client = new StripeSdk(secretKey);
    }
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  private getClient(): Stripe {
    if (!this.client) {
      throw new ServiceUnavailableException({
        error: 'stripe_not_configured',
      });
    }
    return this.client;
  }

  /** Crea PaymentIntent en la cuenta plataforma (fondos retenidos hasta transfer). */
  async createPaymentIntent(params: {
    amount: number;
    currency: string;
    metadata?: Record<string, string>;
    customerId?: string;
  }): Promise<Stripe.PaymentIntent> {
    return this.getClient().paymentIntents.create({
      amount: params.amount,
      currency: params.currency,
      payment_method_types: ['card'],
      metadata: params.metadata,
      ...(params.customerId ? { customer: params.customerId } : {}),
    });
  }

  async retrievePaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    return this.getClient().paymentIntents.retrieve(paymentIntentId);
  }

  /** Confirma PaymentIntent en test mode (pm_card_visa). */
  async confirmPaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    return this.getClient().paymentIntents.confirm(paymentIntentId, {
      payment_method: 'pm_card_visa',
    });
  }

  /**
   * Cuenta Connect para un provider/store (controller properties, no `type`).
   * Stripe hace el onboarding hosted (KYC + cuenta bancaria); el provider usa
   * el Express Dashboard; la plataforma paga fees y cubre pérdidas.
   * Pide `card_payments` + `transfers` (service agreement `full`): requerido
   * para transfers cross-border (plataforma NL → providers en US/CA).
   * Providers son personas (sin empresa registrada): `business_type`
   * `individual` evita que el onboarding pida datos de empresa (KvK, etc.).
   * Prefill debe ir acá: tras crear el account link no se puede editar el KYC.
   */
  async createConnectAccount(params: {
    email?: string;
    country?: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Account> {
    return this.getClient().accounts.create({
      controller: {
        stripe_dashboard: { type: 'express' },
        fees: { payer: 'application' },
        losses: { payments: 'application' },
        requirement_collection: 'stripe',
      },
      email: params.email,
      country: params.country?.toLowerCase(),
      business_type: 'individual',
      business_profile: {
        // Equipment, Tool, Furniture, and Appliance Rental and Leasing
        mcc: '7394',
        product_description:
          'Rents out baby products to customers through the BBGO marketplace.',
      },
      metadata: params.metadata,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
  }

  async retrieveConnectAccount(accountId: string): Promise<Stripe.Account> {
    return this.getClient().accounts.retrieve(accountId);
  }

  /** URL onboarding Stripe (datos bancarios del provider). */
  async createAccountLink(params: {
    accountId: string;
    returnUrl: string;
    refreshUrl: string;
  }): Promise<Stripe.AccountLink> {
    return this.getClient().accountLinks.create({
      account: params.accountId,
      refresh_url: params.refreshUrl,
      return_url: params.returnUrl,
      type: 'account_onboarding',
    });
  }

  /** Transfiere ganancias al connected account cuando el servicio finaliza. */
  async createTransfer(params: {
    amount: number;
    currency: string;
    destinationAccountId: string;
    transferGroup?: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Transfer> {
    return this.getClient().transfers.create({
      amount: params.amount,
      currency: params.currency,
      destination: params.destinationAccountId,
      transfer_group: params.transferGroup,
      metadata: params.metadata,
    });
  }

  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    const secret = this.env.stripeWebhookSecret?.trim();
    if (!secret) {
      throw new BadRequestException({
        error: 'stripe_webhook_secret_not_configured',
      });
    }
    try {
      return this.getClient().webhooks.constructEvent(
        payload,
        signature,
        secret,
      );
    } catch (err) {
      this.logger.warn(
        `Webhook signature verification failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException({ error: 'invalid_webhook_signature' });
    }
  }
}
