import type { Model } from 'mongoose';
import type { EnvService } from '../../config/env.service';
import type { StripeService } from '../../shared/stripe/stripe.service';
import type { StoreDocument } from '../provider/store/store.schema';
import {
  StripeConnectService,
  isInaccessibleAccountError,
} from './stripe-connect.service';

const accountInvalid = Object.assign(new Error('no access'), {
  type: 'StripePermissionError',
  code: 'account_invalid',
});

function makeStore(accountId?: string) {
  return {
    userId: 'user-1',
    country: 'NL',
    meta: { lastSteep: 'customer-pickup' },
    stripeConnect: accountId ? { accountId } : undefined,
    save: jest.fn().mockResolvedValue(undefined),
  };
}

function makeService(store: ReturnType<typeof makeStore>) {
  const storeModel = {
    findById: () => ({ exec: () => Promise.resolve(store) }),
  } as unknown as Model<StoreDocument>;
  const stripe = {
    retrieveConnectAccount: jest.fn(),
    createConnectAccount: jest.fn().mockResolvedValue({ id: 'acct_new' }),
    createAccountLink: jest.fn().mockResolvedValue({
      url: 'https://connect.stripe.com/x',
      expires_at: 1,
    }),
  };
  const env = {
    stripeConnectReturnUrl: 'http://localhost:3000/api/stripe-connect/return',
    stripeConnectRefreshUrl: 'http://localhost:3000/api/stripe-connect/refresh',
  } as EnvService;
  const service = new StripeConnectService(
    storeModel,
    stripe as unknown as StripeService,
    env,
  );
  return { service, stripe };
}

describe('isInaccessibleAccountError', () => {
  it('matches foreign/missing accounts only', () => {
    expect(isInaccessibleAccountError(accountInvalid)).toBe(true);
    expect(isInaccessibleAccountError({ code: 'resource_missing' })).toBe(true);
    expect(isInaccessibleAccountError({ type: 'StripeAPIError' })).toBe(false);
    expect(isInaccessibleAccountError(undefined)).toBe(false);
  });
});

describe('StripeConnectService.createAccountLink', () => {
  it('reuses an accessible account', async () => {
    const store = makeStore('acct_ok');
    const { service, stripe } = makeService(store);
    stripe.retrieveConnectAccount.mockResolvedValue({ id: 'acct_ok' });

    await service.createAccountLink('store-1', 'user-1', {});

    expect(stripe.createConnectAccount).not.toHaveBeenCalled();
    expect(stripe.createAccountLink).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'acct_ok' }),
    );
  });

  it('replaces an account from another platform', async () => {
    const store = makeStore('acct_old');
    const { service, stripe } = makeService(store);
    stripe.retrieveConnectAccount.mockRejectedValue(accountInvalid);

    const res = await service.createAccountLink('store-1', 'user-1', {});

    expect(stripe.createConnectAccount).toHaveBeenCalled();
    expect(res.stripeConnect.accountId).toBe('acct_new');
    expect(store.save).toHaveBeenCalled();
  });

  it('does not replace the account on other Stripe errors', async () => {
    const store = makeStore('acct_ok');
    const { service, stripe } = makeService(store);
    stripe.retrieveConnectAccount.mockRejectedValue({ type: 'StripeAPIError' });

    await expect(
      service.createAccountLink('store-1', 'user-1', {}),
    ).rejects.toBeDefined();
    expect(stripe.createConnectAccount).not.toHaveBeenCalled();
  });
});
