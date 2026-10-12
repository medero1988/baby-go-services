import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AdminService } from './admin.service';

const PROVIDER_ID = new Types.ObjectId().toHexString();
const PRODUCT_ID = new Types.ObjectId().toHexString();

function build(options?: {
  store?: unknown;
  products?: Array<{ _id: Types.ObjectId; status: string; userId: string }>;
}) {
  const productModel = {
    updateMany: jest.fn(() => ({
      exec: () => Promise.resolve({ modifiedCount: 2 }),
    })),
    find: jest.fn(() => ({
      select: () => ({
        lean: () => ({
          exec: () => Promise.resolve(options?.products ?? []),
        }),
        exec: () => Promise.resolve([]),
      }),
    })),
  };
  const bundleModel = {
    find: jest.fn(() => ({
      select: () => ({ exec: () => Promise.resolve([]) }),
    })),
    bulkWrite: jest.fn(),
  };
  const storeModel = {
    findOne: jest.fn(() => ({
      exec: () =>
        Promise.resolve(
          options?.store === undefined ? { _id: 'store' } : options.store,
        ),
    })),
  };
  const service = new AdminService(
    productModel as never,
    bundleModel as never,
    storeModel as never,
  );
  return { service, productModel };
}

describe('AdminService', () => {
  it('rejects an unknown provider', async () => {
    const { service } = build({ store: null });
    await expect(
      service.setProviderProductsStatus(PROVIDER_ID, 'available'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sets every product of a provider to the given status', async () => {
    const { service, productModel } = build();
    const res = await service.setProviderProductsStatus(
      PROVIDER_ID,
      'inactive',
    );
    expect(res).toEqual({
      providerId: PROVIDER_ID,
      status: 'inactive',
      updated: 2,
      bundlesUpdated: 0,
    });
    expect(productModel.updateMany).toHaveBeenCalledWith(
      { $expr: { $eq: [{ $toString: '$userId' }, PROVIDER_ID] } },
      { $set: { status: 'inactive' } },
    );
  });

  it('rejects approving a product that is not in review', async () => {
    const { service } = build({
      products: [
        {
          _id: new Types.ObjectId(PRODUCT_ID),
          status: 'available',
          userId: PROVIDER_ID,
        },
      ],
    });
    try {
      await service.approveProducts([PRODUCT_ID]);
      throw new Error('expected product_not_in_review');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toMatchObject({
        error: 'product_not_in_review',
        productIds: [PRODUCT_ID],
      });
    }
  });
});
