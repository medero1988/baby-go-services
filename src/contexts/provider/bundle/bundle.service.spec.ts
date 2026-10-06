import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ProductStatus } from '../product/product.types';
import { BundleService } from './bundle.service';
import { BundleStatus } from './bundle.types';

const USER_ID = 'user-1';
const BUNDLE_ID = new Types.ObjectId().toHexString();
const PRODUCT_IDS = [
  new Types.ObjectId().toHexString(),
  new Types.ObjectId().toHexString(),
];

function makeProduct(id: string, status: ProductStatus) {
  return { _id: new Types.ObjectId(id), category: 'stroller', status };
}

function makeBundle(status: BundleStatus) {
  const doc = {
    _id: new Types.ObjectId(BUNDLE_ID),
    userId: USER_ID,
    storeId: 'store-1',
    productIds: PRODUCT_IDS.map((id) => new Types.ObjectId(id)),
    title: 'Pack',
    description: 'desc',
    price: { list: 10 },
    category: ['bundle', 'stroller'],
    status,
    save: jest.fn().mockResolvedValue(undefined),
    markModified: jest.fn(),
    toObject() {
      return { ...doc };
    },
  };
  return doc;
}

function build(
  bundle?: ReturnType<typeof makeBundle>,
  productStatus: ProductStatus = 'available',
) {
  const products = PRODUCT_IDS.map((id) => makeProduct(id, productStatus));
  const bundleModel = {
    create: jest.fn((data: Record<string, unknown>) =>
      Promise.resolve({
        toObject: () => ({ _id: new Types.ObjectId(), ...data }),
      }),
    ),
    findById: jest.fn(() => ({
      exec: () => Promise.resolve(bundle ?? null),
    })),
    findOne: jest.fn(() => ({
      lean: () => ({ exec: () => Promise.resolve(null) }),
    })),
  };
  const storeService = {
    requireStoreForProvider: jest.fn().mockResolvedValue({ _id: 'store-1' }),
  };
  const productService = {
    requireOwnedProducts: jest.fn().mockResolvedValue(products),
    loadOwnedProducts: jest.fn().mockResolvedValue(products),
    toResponse: jest.fn((p: { _id: Types.ObjectId }) => ({
      id: String(p._id),
    })),
  };
  const service = new BundleService(
    bundleModel as never,
    storeService as never,
    productService as never,
  );
  return { service, bundleModel, productService };
}

async function expectError(promise: Promise<unknown>, error: string) {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getResponse()).toMatchObject({
      error,
    });
    return;
  }
  throw new Error(`expected ${error}`);
}

describe('BundleService', () => {
  it.each([
    ['in_review', 'in_review'],
    ['available', 'available'],
    ['inactive', 'available'],
    ['rented', 'available'],
  ] as const)(
    'creates the bundle with %s products as %s',
    async (productStatus, expected) => {
      const { service, bundleModel } = build(undefined, productStatus);
      const res = await service.create(USER_ID, {
        products: PRODUCT_IDS,
        title: 'Pack',
        description: 'desc',
        price: { list: 10 },
      });
      expect(bundleModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: expected }),
      );
      expect(res.status).toBe(expected);
    },
  );

  it('creates the bundle in_review when only one product is in_review', async () => {
    const { service, bundleModel, productService } = build();
    productService.requireOwnedProducts.mockResolvedValue([
      makeProduct(PRODUCT_IDS[0], 'available'),
      makeProduct(PRODUCT_IDS[1], 'in_review'),
    ]);
    await service.create(USER_ID, {
      products: PRODUCT_IDS,
      title: 'Pack',
      description: 'desc',
      price: { list: 10 },
    });
    expect(bundleModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'in_review' }),
    );
  });

  it.each([
    ['available', 'inactive'],
    ['inactive', 'available'],
  ] as const)('lets the provider move %s → %s', async (from, to) => {
    const bundle = makeBundle(from);
    const { service } = build(bundle);
    const res = await service.update(BUNDLE_ID, USER_ID, { status: to });
    expect(res.status).toBe(to);
    expect(bundle.save).toHaveBeenCalled();
  });

  it.each(['in_review', 'rented'] as const)(
    'rejects status changes from %s',
    async (from) => {
      const bundle = makeBundle(from);
      const { service } = build(bundle);
      await expectError(
        service.update(BUNDLE_ID, USER_ID, { status: 'available' }),
        'invalid_status_transition',
      );
      expect(bundle.save).not.toHaveBeenCalled();
    },
  );

  it('keeps the bundle in_review when made available with a product in_review', async () => {
    const bundle = makeBundle('inactive');
    const { service } = build(bundle, 'in_review');
    const res = await service.update(BUNDLE_ID, USER_ID, {
      status: 'available',
    });
    expect(res.status).toBe('in_review');
  });

  it('moves an available bundle to in_review when an in_review product is added', async () => {
    const bundle = makeBundle('available');
    const { service } = build(bundle, 'in_review');
    const res = await service.update(BUNDLE_ID, USER_ID, {
      products: PRODUCT_IDS,
    });
    expect(res.status).toBe('in_review');
  });

  it('leaves an inactive bundle inactive on edit', async () => {
    const bundle = makeBundle('inactive');
    const { service } = build(bundle, 'in_review');
    const res = await service.update(BUNDLE_ID, USER_ID, { title: 'Pack 2' });
    expect(res.status).toBe('inactive');
  });
});
