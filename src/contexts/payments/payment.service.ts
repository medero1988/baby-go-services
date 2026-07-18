import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { EnvService } from '../../config/env.service';
import { StripeService } from '../../shared/stripe/stripe.service';
import { StoreDocument } from '../provider/store/store.schema';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { ProviderMovementsQueryDto } from './dto/provider-movements-query.dto';
import { PaymentDocument } from './payment.schema';
import {
  CreatePaymentIntentResponse,
  PaymentResponse,
  PaymentStatus,
  ProviderMovement,
  ProviderMovementsResponse,
  ProviderMovementsSummary,
} from './payment.types';

export const PAYMENT_ERRORS = {
  STORE_NOT_READY: 'store_not_ready_for_payments',
  PAYMENT_NOT_SUCCEEDED: 'payment_not_succeeded',
  ALREADY_TRANSFERRED: 'already_transferred',
  INVALID_AMOUNT: 'invalid_amount',
} as const;

@Injectable()
export class PaymentService {
  constructor(
    @InjectModel('Payment')
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel('Store') private readonly storeModel: Model<StoreDocument>,
    private stripe: StripeService,
    private env: EnvService,
  ) {}

  /** Cobra al cliente; fondos quedan en cuenta plataforma hasta completar servicio. */
  async createPaymentIntent(
    userId: string,
    dto: CreatePaymentIntentDto,
  ): Promise<CreatePaymentIntentResponse> {
    const store = await this.storeModel.findById(dto.storeId).lean().exec();
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    if (
      !store.stripeConnect?.accountId ||
      !store.stripeConnect.onboardingComplete
    ) {
      throw new BadRequestException({
        error: PAYMENT_ERRORS.STORE_NOT_READY,
        message: 'Store has not completed Stripe Connect onboarding',
      });
    }

    const currency = (
      dto.currency ?? this.env.stripeDefaultCurrency
    ).toLowerCase();
    const { providerAmount, platformFeeAmount } = this.splitAmounts(dto.amount);

    const intent = await this.stripe.createPaymentIntent({
      amount: dto.amount,
      currency,
      metadata: {
        userId,
        storeId: dto.storeId,
        ...(dto.orderId ? { orderId: dto.orderId } : {}),
      },
    });

    const payment = await this.paymentModel.create({
      userId,
      storeId: dto.storeId,
      orderId: dto.orderId,
      stripePaymentIntentId: intent.id,
      amount: dto.amount,
      providerAmount,
      platformFeeAmount,
      currency,
      status: mapStripeStatus(intent.status),
    });

    return {
      payment: this.toPaymentResponse(payment.toObject()),
      clientSecret: intent.client_secret!,
      publishableKey: this.env.stripePublishableKey,
    };
  }

  /**
   * Al completar el servicio de alquiler: transfiere ganancias al provider.
   * La comisión de plataforma permanece en la cuenta empresa.
   */
  async transferToProvider(
    paymentId: string,
    userId: string,
  ): Promise<PaymentResponse> {
    const payment = await this.paymentModel.findById(paymentId).exec();
    if (!payment || String(payment.userId) !== userId) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.status === 'transferred') {
      throw new BadRequestException({
        error: PAYMENT_ERRORS.ALREADY_TRANSFERRED,
      });
    }
    if (payment.status !== 'succeeded') {
      throw new BadRequestException({
        error: PAYMENT_ERRORS.PAYMENT_NOT_SUCCEEDED,
        message:
          'Payment must be succeeded before transfer. Confirm the PaymentIntent first (app clientSecret or POST /payments/:id/confirm-test in dev).',
        currentStatus: payment.status,
      });
    }

    const store = await this.storeModel.findById(payment.storeId).lean().exec();
    if (!store?.stripeConnect?.accountId) {
      throw new BadRequestException({
        error: PAYMENT_ERRORS.STORE_NOT_READY,
      });
    }

    const transfer = await this.stripe.createTransfer({
      amount: payment.providerAmount,
      currency: payment.currency,
      destinationAccountId: store.stripeConnect.accountId,
      transferGroup: payment.stripePaymentIntentId,
      metadata: {
        paymentId: String(payment._id),
        storeId: String(payment.storeId),
      },
    });

    payment.status = 'transferred';
    payment.stripeTransferId = transfer.id;
    await payment.save();

    return this.toPaymentResponse(payment.toObject());
  }

  async findById(paymentId: string, userId: string): Promise<PaymentResponse> {
    const payment = await this.paymentModel.findById(paymentId).lean().exec();
    if (!payment || String(payment.userId) !== userId) {
      throw new NotFoundException('Payment not found');
    }
    return this.toPaymentResponse(payment);
  }

  /**
   * Solo desarrollo: confirma el PaymentIntent con tarjeta test (pm_card_visa).
   * En producción la app confirma con clientSecret + Stripe.js.
   */
  async confirmPaymentForDev(
    paymentId: string,
    userId: string,
  ): Promise<PaymentResponse> {
    if (this.env.isProduction) {
      throw new BadRequestException({ error: 'not_available_in_production' });
    }

    const payment = await this.paymentModel.findById(paymentId).exec();
    if (!payment || String(payment.userId) !== userId) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.status === 'succeeded' || payment.status === 'transferred') {
      return this.toPaymentResponse(payment.toObject());
    }

    const intent = await this.stripe.confirmPaymentIntent(
      payment.stripePaymentIntentId,
    );
    payment.status = mapStripeStatus(intent.status);
    await payment.save();

    return this.toPaymentResponse(payment.toObject());
  }

  /**
   * Movimientos de pago del proveedor (dueño de las stores).
   * Devuelve el detalle de cada pago y un resumen con totales de ganancias y comisiones.
   */
  async getProviderMovements(
    providerUserId: string,
    query: ProviderMovementsQueryDto,
  ): Promise<ProviderMovementsResponse> {
    // Las referencias (userId/storeId) pueden estar guardadas como string u
    // ObjectId; comparamos por su forma string con $toString para ser robustos.
    const stores = await this.storeModel
      .find({ $expr: { $eq: [{ $toString: '$userId' }, providerUserId] } })
      .select('_id name')
      .lean()
      .exec();

    const scopedStores = query.storeId
      ? stores.filter((store) => String(store._id) === query.storeId)
      : stores;

    const storeNameById = new Map<string, string>();
    for (const store of scopedStores) {
      storeNameById.set(String(store._id), store.name);
    }

    const storeIdStrings = scopedStores.map((store) => String(store._id));
    if (storeIdStrings.length === 0) {
      return { summary: this.emptyMovementsSummary(), movements: [] };
    }

    const paymentFilter: Record<string, unknown> = {
      $expr: { $in: [{ $toString: '$storeId' }, storeIdStrings] },
    };
    if (query.status) {
      paymentFilter.status = query.status;
    }

    const payments = await this.paymentModel
      .find(paymentFilter)
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const movements: ProviderMovement[] = payments.map((doc) => ({
      id: String(doc._id),
      storeId: String(doc.storeId),
      storeName: storeNameById.get(String(doc.storeId)) ?? '',
      orderId: doc.orderId,
      amount: doc.amount,
      providerAmount: doc.providerAmount,
      platformFeeAmount: doc.platformFeeAmount,
      currency: doc.currency,
      status: doc.status,
      transferred: doc.status === 'transferred',
      stripeTransferId: doc.stripeTransferId,
      stripePaymentIntentId: doc.stripePaymentIntentId,
      createdAt: doc.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: doc.updatedAt?.toISOString() ?? new Date().toISOString(),
    }));

    return {
      summary: this.buildMovementsSummary(movements),
      movements,
    };
  }

  private emptyMovementsSummary(): ProviderMovementsSummary {
    return {
      totalMovements: 0,
      currency: this.env.stripeDefaultCurrency.toLowerCase(),
      collected: 0,
      earningsTransferred: 0,
      earningsPending: 0,
      platformFees: 0,
    };
  }

  private buildMovementsSummary(
    movements: ProviderMovement[],
  ): ProviderMovementsSummary {
    const summary = this.emptyMovementsSummary();
    summary.totalMovements = movements.length;
    if (movements.length > 0) {
      summary.currency = movements[0].currency;
    }

    for (const m of movements) {
      const collected = m.status === 'succeeded' || m.status === 'transferred';
      if (collected) {
        summary.collected += m.amount;
        summary.platformFees += m.platformFeeAmount;
      }
      if (m.status === 'transferred') {
        summary.earningsTransferred += m.providerAmount;
      } else if (m.status === 'succeeded') {
        summary.earningsPending += m.providerAmount;
      }
    }

    return summary;
  }

  async syncPaymentIntentStatus(
    stripePaymentIntentId: string,
    stripeStatus: Stripe.PaymentIntent.Status,
  ): Promise<void> {
    const status = mapStripeStatus(stripeStatus);
    await this.paymentModel
      .updateOne({ stripePaymentIntentId }, { $set: { status } })
      .exec();
  }

  private splitAmounts(totalAmount: number): {
    providerAmount: number;
    platformFeeAmount: number;
  } {
    const feePercent = this.env.stripePlatformFeePercent;
    const platformFeeAmount = Math.round((totalAmount * feePercent) / 100);
    const providerAmount = totalAmount - platformFeeAmount;

    if (providerAmount <= 0) {
      throw new BadRequestException({
        error: PAYMENT_ERRORS.INVALID_AMOUNT,
        message: 'Amount too low after platform fee',
      });
    }

    return { providerAmount, platformFeeAmount };
  }

  private toPaymentResponse(doc: {
    _id: unknown;
    userId: unknown;
    storeId: unknown;
    orderId?: string;
    stripePaymentIntentId: string;
    amount: number;
    providerAmount: number;
    platformFeeAmount: number;
    currency: string;
    status: PaymentStatus;
    stripeTransferId?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }): PaymentResponse {
    return {
      id: String(doc._id),
      userId: String(doc.userId),
      storeId: String(doc.storeId),
      orderId: doc.orderId,
      stripePaymentIntentId: doc.stripePaymentIntentId,
      amount: doc.amount,
      providerAmount: doc.providerAmount,
      platformFeeAmount: doc.platformFeeAmount,
      currency: doc.currency,
      status: doc.status,
      stripeTransferId: doc.stripeTransferId,
      createdAt: doc.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: doc.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }
}

function mapStripeStatus(status: Stripe.PaymentIntent.Status): PaymentStatus {
  const allowed: PaymentStatus[] = [
    'requires_payment_method',
    'requires_confirmation',
    'requires_action',
    'processing',
    'succeeded',
    'canceled',
  ];
  if (allowed.includes(status as PaymentStatus)) {
    return status as PaymentStatus;
  }
  return 'failed';
}
