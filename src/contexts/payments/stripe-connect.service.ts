import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EnvService } from '../../config/env.service';
import { StripeService } from '../../shared/stripe/stripe.service';
import { StoreDocument } from '../provider/store/store.schema';
import { CreateStripeAccountLinkDto } from './dto/create-stripe-account-link.dto';
import { AccountLinkResponse } from './payment.types';
import { StripeConnectStatus } from '../provider/store/store.types';

@Injectable()
export class StripeConnectService {
  constructor(
    @InjectModel('Store') private readonly storeModel: Model<StoreDocument>,
    private stripe: StripeService,
    private env: EnvService,
  ) {}

  /** Crea (si no existe) cuenta Connect Express y devuelve URL de onboarding. */
  async createAccountLink(
    storeId: string,
    userId: string,
    dto: CreateStripeAccountLinkDto,
  ): Promise<AccountLinkResponse> {
    const store = await this.storeModel
      .findOne({ _id: storeId, userId })
      .exec();
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    let accountId = store.stripeConnect?.accountId;

    if (!accountId) {
      const account = await this.stripe.createConnectAccount({
        country: store.country,
        metadata: { storeId, userId },
      });
      accountId = account.id;
      store.stripeConnect = {
        accountId,
        onboardingComplete: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      };
      store.meta.lastSteep = 'bank-account';
      await store.save();
    }

    const returnUrl = dto.returnUrl ?? this.env.stripeConnectReturnUrl;
    const refreshUrl = dto.refreshUrl ?? this.env.stripeConnectRefreshUrl;
    assertStripeRedirectUrl(returnUrl, 'returnUrl');
    assertStripeRedirectUrl(refreshUrl, 'refreshUrl');

    let link;
    try {
      link = await this.stripe.createAccountLink({
        accountId,
        returnUrl,
        refreshUrl,
      });
    } catch (err) {
      throw mapStripeConnectError(err);
    }

    return {
      url: link.url,
      expiresAt: link.expires_at,
      stripeConnect: store.stripeConnect ?? {
        accountId,
        onboardingComplete: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      },
    };
  }

  /** Sincroniza estado Connect desde Stripe (post-onboarding o polling). */
  async syncConnectStatus(
    storeId: string,
    userId: string,
  ): Promise<StripeConnectStatus> {
    const store = await this.storeModel
      .findOne({ _id: storeId, userId })
      .exec();
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    if (!store.stripeConnect?.accountId) {
      throw new BadRequestException({
        error: 'stripe_connect_not_started',
      });
    }

    const account = await this.stripe.retrieveConnectAccount(
      store.stripeConnect.accountId,
    );

    store.stripeConnect = mapStripeAccountToConnectStatus(
      store.stripeConnect.accountId,
      account,
    );
    if (store.stripeConnect.onboardingComplete) {
      store.meta.lastSteep = 'bank-account';
    }
    await store.save();

    return store.stripeConnect;
  }

  async handleAccountUpdated(account: {
    id: string;
    charges_enabled?: boolean;
    payouts_enabled?: boolean;
    details_submitted?: boolean;
  }): Promise<void> {
    const store = await this.storeModel
      .findOne({ 'stripeConnect.accountId': account.id })
      .exec();
    if (!store) return;

    store.stripeConnect = mapStripeAccountToConnectStatus(account.id, account);
    if (store.stripeConnect.onboardingComplete) {
      store.meta.lastSteep = 'bank-account';
    }
    await store.save();
  }

  /** Sincroniza store desde Stripe API (webhooks capability.updated, etc.). */
  async syncAccountByStripeId(accountId: string): Promise<void> {
    const store = await this.storeModel
      .findOne({ 'stripeConnect.accountId': accountId })
      .exec();
    if (!store) return;

    const account = await this.stripe.retrieveConnectAccount(accountId);
    store.stripeConnect = mapStripeAccountToConnectStatus(accountId, account);
    if (store.stripeConnect.onboardingComplete) {
      store.meta.lastSteep = 'bank-account';
    }
    await store.save();
  }
}

function mapStripeAccountToConnectStatus(
  accountId: string,
  account: {
    charges_enabled?: boolean;
    payouts_enabled?: boolean;
    details_submitted?: boolean;
  },
): StripeConnectStatus {
  const chargesEnabled = account.charges_enabled === true;
  const payoutsEnabled = account.payouts_enabled === true;
  const detailsSubmitted = account.details_submitted === true;

  return {
    accountId,
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted,
    onboardingComplete: chargesEnabled && payoutsEnabled && detailsSubmitted,
  };
}

const STRIPE_REDIRECT_URL = /^https?:\/\/.+/i;

function assertStripeRedirectUrl(url: string, field: string): void {
  const trimmed = url?.trim();
  if (!trimmed || !STRIPE_REDIRECT_URL.test(trimmed)) {
    throw new BadRequestException({
      error: 'invalid_stripe_redirect_url',
      message: `${field} must be a valid http or https URL (Stripe does not accept custom schemes like babygo://)`,
      field,
    });
  }
}

function mapStripeConnectError(err: unknown): BadRequestException {
  if (
    err &&
    typeof err === 'object' &&
    'type' in err &&
    err.type === 'StripeInvalidRequestError'
  ) {
    const stripeErr = err as {
      message?: string;
      param?: string;
      code?: string;
    };
    return new BadRequestException({
      error: stripeErr.code ?? 'stripe_invalid_request',
      message: stripeErr.message ?? 'Stripe request failed',
      param: stripeErr.param,
    });
  }
  throw err;
}
