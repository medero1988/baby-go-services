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

  /** Cuenta Connect Express para un provider/store. */
  async createConnectAccount(params: {
    email?: string;
    country?: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Account> {
    return this.getClient().accounts.create({
      type: 'express',
      email: params.email,
      country: params.country?.toLowerCase(),
      metadata: params.metadata,
      capabilities: {
        transfers: { requested: true },
      },
    });
  }

  async retrieveConnectAccount(accountId: string): Promise<Stripe.Account> {
    return this.getClient().accounts.retrieve(accountId);
  }

  /**
   * Crea un token bancario (btok_...) a partir de los datos de payout.
   * Para IBAN, `accountNumber` = el IBAN completo.
   */
  async createBankAccountToken(params: {
    country: string;
    currency: string;
    accountNumber: string;
    routingNumber?: string;
    accountHolderName: string;
    accountHolderType: 'individual' | 'company';
  }): Promise<Stripe.Token> {
    return this.getClient().tokens.create({
      bank_account: {
        country: params.country.toUpperCase(),
        currency: params.currency.toLowerCase(),
        account_number: params.accountNumber,
        account_holder_name: params.accountHolderName,
        account_holder_type: params.accountHolderType,
        ...(params.routingNumber
          ? { routing_number: params.routingNumber }
          : {}),
      },
    });
  }

  /** Adjunta una cuenta externa (bank account) al connected account. */
  async attachExternalBankAccount(
    accountId: string,
    bankAccountToken: string,
  ): Promise<Stripe.BankAccount> {
    const result = await this.getClient().accounts.createExternalAccount(
      accountId,
      { external_account: bankAccountToken },
    );
    return result as Stripe.BankAccount;
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
