import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ProductService } from './product.service';
import { ProductStatus } from './product.types';

const USER_ID = 'user-1';
const PRODUCT_ID = new Types.ObjectId().toHexString();

function makeDoc(status: ProductStatus) {
  const doc = {
    _id: new Types.ObjectId(PRODUCT_ID),
    userId: USER_ID,
    storeId: 'store-1',
    category: 'stroller',
    title: 'Bugaboo',
    description: 'desc',
    price: { list: 10 },
    attributes: {},
    medias: [],
    status,
    save: jest.fn().mockResolvedValue(undefined),
    markModified: jest.fn(),
    toObject() {
      return { ...doc };
    },
  };
  return doc;
}

function build(doc?: ReturnType<typeof makeDoc>) {
  const productModel = {
    create: jest.fn((data: Record<string, unknown>) =>
      Promise.resolve({
        toObject: () => ({ _id: new Types.ObjectId(), ...data }),
      }),
    ),
    findById: jest.fn(() => ({ exec: () => Promise.resolve(doc ?? null) })),
    findOne: jest.fn(() => ({
      lean: () => ({ exec: () => Promise.resolve(null) }),
    })),
  };
  const bundleModel = {
    updateMany: jest.fn(() => ({ exec: () => Promise.resolve() })),
  };
  const storeService = {
    requireStoreForProvider: jest.fn().mockResolvedValue({ _id: 'store-1' }),
  };
  const storage = { imageUrls: jest.fn(() => ({})) };
  const service = new ProductService(
    productModel as never,
    bundleModel as never,
    storeService as never,
    storage as never,
  );
  return { service, productModel, bundleModel };
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

describe('ProductService', () => {
  describe('create', () => {
    it('creates products in_review with the given category', async () => {
      const { service, productModel } = build();
      const res = await service.create(USER_ID, {
        category: 'baby-carrier',
        title: 'Ergobaby',
        description: 'Omni',
        price: { list: 5 },
      });
      expect(productModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'in_review',
          category: 'baby-carrier',
        }),
      );
      expect(res.status).toBe('in_review');
      expect(res.category).toBe('baby-carrier');
    });
  });

  describe('update status', () => {
    it.each<[ProductStatus, 'available' | 'inactive']>([
      ['available', 'inactive'],
      ['inactive', 'available'],
      ['available', 'available'],
      ['inactive', 'inactive'],
    ])('allows %s -> %s', async (from, to) => {
      const doc = makeDoc(from);
      const { service } = build(doc);
      const res = await service.update(PRODUCT_ID, USER_ID, { status: to });
      expect(res.status).toBe(to);
      expect(doc.save).toHaveBeenCalled();
    });

    it.each<[ProductStatus, 'available' | 'inactive']>([
      ['in_review', 'available'],
      ['in_review', 'inactive'],
      ['rented', 'available'],
      ['rented', 'inactive'],
    ])('rejects %s -> %s', async (from, to) => {
      const doc = makeDoc(from);
      const { service } = build(doc);
      await expectError(
        service.update(PRODUCT_ID, USER_ID, { status: to }),
        'invalid_status_transition',
      );
      expect(doc.status).toBe(from);
      expect(doc.save).not.toHaveBeenCalled();
    });

    it('keeps the current status when only the price changes', async () => {
      const doc = makeDoc('available');
      const { service, bundleModel } = build(doc);
      const res = await service.update(PRODUCT_ID, USER_ID, {
        price: { list: 20 },
      });
      expect(res.price.list).toBe(20);
      expect(res.status).toBe('available');
      expect(bundleModel.updateMany).not.toHaveBeenCalled();
    });

    it.each(['available', 'inactive', 'rented', 'in_review'] as const)(
      'sends a %s product back to in_review when its data changes',
      async (from) => {
        const doc = makeDoc(from);
        const { service, bundleModel } = build(doc);
        const res = await service.update(PRODUCT_ID, USER_ID, {
          description: 'new',
        });
        expect(res.description).toBe('new');
        expect(res.status).toBe('in_review');
        expect(bundleModel.updateMany).toHaveBeenCalledWith(
          {
            productIds: new Types.ObjectId(PRODUCT_ID),
            status: 'available',
          },
          { $set: { status: 'in_review' } },
        );
      },
    );
  });

  describe('removeAll', () => {
    it('deletes every product, its photos and the provider bundles', async () => {
      const doc = makeDoc('available');
      doc.medias = [
        { url: 'https://cdn/a.png', publicId: 'products/a' },
      ] as never;
      const productModel = {
        find: jest.fn(() => ({ exec: () => Promise.resolve([doc]) })),
        deleteMany: jest.fn(() => ({
          exec: () => Promise.resolve({ deletedCount: 1 }),
        })),
      };
      const bundleModel = {
        deleteMany: jest.fn(() => ({
          exec: () => Promise.resolve({ deletedCount: 1 }),
        })),
      };
      const storage = {
        delete: jest.fn().mockResolvedValue(undefined),
        imageUrls: jest.fn(() => ({})),
      };
      const service = new ProductService(
        productModel as never,
        bundleModel as never,
        {} as never,
        storage as never,
      );

      const res = await service.removeAll(USER_ID);

      expect(res).toEqual({ success: true, deleted: 1 });
      expect(storage.delete).toHaveBeenCalledWith({
        url: 'https://cdn/a.png',
        publicId: 'products/a',
      });
      expect(bundleModel.deleteMany).toHaveBeenCalledWith({
        $expr: { $eq: [{ $toString: '$userId' }, USER_ID] },
      });
      expect(productModel.deleteMany).toHaveBeenCalledWith({
        _id: { $in: [doc._id] },
      });
    });
  });

  it('no longer exposes save()', () => {
    const { service } = build();
    expect((service as unknown as Record<string, unknown>).save).toBe(
      undefined,
    );
  });
});
