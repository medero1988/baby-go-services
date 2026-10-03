import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type Stripe from 'stripe';
import { EnvService } from '../../config/env.service';
import { StripeService } from '../../shared/stripe/stripe.service';
import { StoreDocument } from '../provider/store/store.schema';
import { CreateStripeAccountLinkDto } from './dto/create-stripe-account-link.dto';
import { AccountLinkResponse } from './payment.types';
import { StripeConnectStatus } from '../provider/store/store.types';
import { toAppDeepLink } from './stripe-connect-redirect.controller';

@Injectable()
export class StripeConnectService {
  constructor(
    @InjectModel('Store') private readonly storeModel: Model<StoreDocument>,
    private stripe: StripeService,
    private env: EnvService,
  ) {}

  /** Crea (si no existe) cuenta Connect y devuelve URL de onboarding hosted. */
  async createAccountLink(
    storeId: string,
    userId: string,
    dto: CreateStripeAccountLinkDto,
  ): Promise<AccountLinkResponse> {
    const store = await this.requireOwnedStore(storeId, userId);

    let accountId = store.stripeConnect?.accountId;

    if (!accountId) {
      let account: Stripe.Account;
      try {
        account = await this.stripe.createConnectAccount({
          country: store.country,
          metadata: { storeId, userId },
        });
      } catch (err) {
        throw mapStripeConnectError(err);
      }
      accountId = account.id;
      store.stripeConnect = emptyConnectStatus(accountId);
      store.meta.lastSteep = 'bank-account';
      await store.save();
    }

    let appRedirect: string | undefined;
    if (dto.appRedirectUrl !== undefined) {
      appRedirect = toAppDeepLink(dto.appRedirectUrl);
      if (!appRedirect) {
        throw new BadRequestException({
          error: 'invalid_app_redirect_url',
          message:
            'appRedirectUrl must be an app deep link (e.g. bbgo://...), not a web URL',
          field: 'appRedirectUrl',
        });
      }
    }

    const returnUrl = dto.returnUrl ?? this.env.stripeConnectReturnUrl;
    const refreshUrl = dto.refreshUrl ?? this.env.stripeConnectRefreshUrl;
    assertStripeRedirectUrl(returnUrl, 'returnUrl');
    assertStripeRedirectUrl(refreshUrl, 'refreshUrl');

    let link: Stripe.AccountLink;
    try {
      link = await this.stripe.createAccountLink({
        accountId,
        returnUrl: withAppRedirect(returnUrl, appRedirect),
        refreshUrl: withAppRedirect(refreshUrl, appRedirect),
      });
    } catch (err) {
      throw mapStripeConnectError(err);
    }

    return {
      url: link.url,
      expiresAt: link.expires_at,
      stripeConnect: store.stripeConnect ?? emptyConnectStatus(accountId),
    };
  }

  /** Sincroniza estado Connect desde Stripe (post-onboarding o polling). */
  async syncConnectStatus(
    storeId: string,
    userId: string,
  ): Promise<StripeConnectStatus> {
    const store = await this.requireOwnedStore(storeId, userId);
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

  async handleAccountUpdated(
    account: StripeAccountFlags & { id: string },
  ): Promise<void> {
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

  private async requireOwnedStore(storeId: string, userId: string) {
    const store = await this.storeModel.findById(storeId).exec();
    if (!store || String(store.userId) !== userId) {
      throw new NotFoundException('Store not found');
    }
    return store;
  }
}

type StripeAccountFlags = Pick<
  Stripe.Account,
  'charges_enabled' | 'payouts_enabled' | 'details_submitted' | 'capabilities'
>;

function emptyConnectStatus(accountId: string): StripeConnectStatus {
  return {
    accountId,
    onboardingComplete: false,
    chargesEnabled: false,
    payoutsEnabled: false,
    transfersEnabled: false,
    detailsSubmitted: false,
  };
}

/**
 * `onboardingComplete` = la plataforma puede transferir ganancias al provider
 * y Stripe puede pagarlas a su banco. `chargesEnabled` es informativo: los
 * cobros se hacen en la cuenta plataforma, no en la del provider.
 */
function mapStripeAccountToConnectStatus(
  accountId: string,
  account: StripeAccountFlags,
): StripeConnectStatus {
  const chargesEnabled = account.charges_enabled === true;
  const payoutsEnabled = account.payouts_enabled === true;
  const transfersEnabled = account.capabilities?.transfers === 'active';
  const detailsSubmitted = account.details_submitted === true;

  return {
    accountId,
    chargesEnabled,
    payoutsEnabled,
    transfersEnabled,
    detailsSubmitted,
    onboardingComplete: detailsSubmitted && payoutsEnabled && transfersEnabled,
  };
}

function withAppRedirect(url: string, appRedirect?: string): string {
  if (!appRedirect) return url;
  const parsed = new URL(url.trim());
  parsed.searchParams.set('redirect', appRedirect);
  return parsed.toString();
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
