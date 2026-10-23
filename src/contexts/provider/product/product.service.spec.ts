import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
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
    medias: [] as { _id?: Types.ObjectId; url: string; publicId?: string }[],
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
  const storage = {
    imageUrls: jest.fn(() => ({})),
    delete: jest.fn().mockResolvedValue(undefined),
    uploadImage: jest.fn(({ filename }: { filename: string }) =>
      Promise.resolve({ url: `https://cdn/${filename}`, publicId: filename }),
    ),
  };
  const service = new ProductService(
    productModel as never,
    bundleModel as never,
    storeService as never,
    storage as never,
  );
  return { service, productModel, bundleModel, storage };
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

  describe('remove', () => {
    function buildRemove(
      doc: ReturnType<typeof makeDoc> | null,
      opts: { deletedCount?: number; afterDelete?: unknown } = {},
    ) {
      if (doc) {
        doc.medias = [
          { url: 'https://cdn/a.png', publicId: 'products/a' },
        ] as never;
      }
      const productModel = {
        findById: jest
          .fn()
          .mockReturnValueOnce({ exec: () => Promise.resolve(doc) })
          .mockReturnValue({
            lean: () => ({
              exec: () => Promise.resolve(opts.afterDelete ?? null),
            }),
          }),
        deleteOne: jest.fn(() => ({
          exec: () => Promise.resolve({ deletedCount: opts.deletedCount ?? 1 }),
        })),
      };
      const bundleModel = {
        updateMany: jest.fn(() => ({ exec: () => Promise.resolve() })),
        deleteMany: jest.fn(() => ({ exec: () => Promise.resolve() })),
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
      return { service, productModel, bundleModel, storage };
    }

    async function expectRented(promise: Promise<unknown>) {
      const err = await promise.then(
        () => null,
        (e: unknown) => e,
      );
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getStatus()).toBe(409);
      expect((err as ConflictException).getResponse()).toEqual({
        error: 'product_rented',
        message: 'A rented product cannot be deleted',
      });
    }

    it('409 product_rented for a rented product and deletes nothing', async () => {
      const { service, productModel, bundleModel, storage } = buildRemove(
        makeDoc('rented'),
      );

      await expectRented(service.remove(PRODUCT_ID, USER_ID));

      expect(storage.delete).not.toHaveBeenCalled();
      expect(bundleModel.updateMany).not.toHaveBeenCalled();
      expect(bundleModel.deleteMany).not.toHaveBeenCalled();
      expect(productModel.deleteOne).not.toHaveBeenCalled();
    });

    it('404 product_not_found (not 409) for another provider rented product', async () => {
      const doc = makeDoc('rented');
      doc.userId = 'other-user';
      const { service, productModel, bundleModel, storage } = buildRemove(doc);

      const err = await service.remove(PRODUCT_ID, USER_ID).then(
        () => null,
        (e: unknown) => e,
      );
      expect(err).toBeInstanceOf(NotFoundException);
      expect((err as NotFoundException).getResponse()).toEqual({
        error: 'product_not_found',
      });
      expect(storage.delete).not.toHaveBeenCalled();
      expect(bundleModel.updateMany).not.toHaveBeenCalled();
      expect(productModel.deleteOne).not.toHaveBeenCalled();
    });

    it.each<ProductStatus>(['available', 'inactive', 'in_review'])(
      'deletes a %s product, its photos and detaches it from bundles',
      async (status) => {
        const doc = makeDoc(status);
        const { service, productModel, bundleModel, storage } =
          buildRemove(doc);

        await expect(service.remove(PRODUCT_ID, USER_ID)).resolves.toEqual({
          success: true,
        });

        expect(productModel.deleteOne).toHaveBeenCalledWith({
          _id: doc._id,
          status: { $ne: 'rented' },
        });
        expect(bundleModel.updateMany).toHaveBeenCalled();
        expect(bundleModel.deleteMany).toHaveBeenCalled();
        expect(storage.delete).toHaveBeenCalledWith({
          url: 'https://cdn/a.png',
          publicId: 'products/a',
        });
      },
    );

    it('409 and no side effects when it became rented before the conditional delete', async () => {
      const { service, bundleModel, storage } = buildRemove(
        makeDoc('available'),
        { deletedCount: 0, afterDelete: { status: 'rented' } },
      );

      await expectRented(service.remove(PRODUCT_ID, USER_ID));

      expect(storage.delete).not.toHaveBeenCalled();
      expect(bundleModel.updateMany).not.toHaveBeenCalled();
      expect(bundleModel.deleteMany).not.toHaveBeenCalled();
    });

    it('404 when it was deleted concurrently before the conditional delete', async () => {
      const { service, storage } = buildRemove(makeDoc('available'), {
        deletedCount: 0,
        afterDelete: null,
      });

      await expect(service.remove(PRODUCT_ID, USER_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(storage.delete).not.toHaveBeenCalled();
    });
  });

  it('no longer exposes save()', () => {
    const { service } = build();
    expect((service as unknown as Record<string, unknown>).save).toBe(
      undefined,
    );
  });
});

describe('ProductService medias order', () => {
  const OTHER_USER = 'user-2';

  function media(id = new Types.ObjectId()) {
    return { _id: id, url: `https://cdn/${String(id)}.jpg`, publicId: 'p' };
  }

  function docWithMedias(count: number, status: ProductStatus = 'available') {
    const doc = makeDoc(status);
    doc.medias = Array.from({ length: count }, () => media());
    return doc;
  }

  const idsOf = (doc: { medias: { _id?: Types.ObjectId }[] }) =>
    doc.medias.map((m) => String(m._id));

  const png = {
    fieldname: 'media',
    mimetype: 'image/png',
    originalname: 'a.png',
    buffer: Buffer.from('png'),
  } as Express.Multer.File;

  describe('reorderMedias', () => {
    it('stores the new order and returns the reordered medias (head first)', async () => {
      const doc = docWithMedias(3);
      const [a, b, c] = idsOf(doc);
      const { service } = build(doc);

      const res = await service.reorderMedias(PRODUCT_ID, USER_ID, [c, a, b]);

      expect(res.map((m) => m.id)).toEqual([c, a, b]);
      expect(res[0]).toHaveProperty('urls');
      expect(idsOf(doc)).toEqual([c, a, b]);
      expect(doc.markModified).toHaveBeenCalledWith('medias');
      expect(doc.save).toHaveBeenCalled();
    });

    it('does not send the product or its bundles back to review', async () => {
      const doc = docWithMedias(2, 'available');
      const [a, b] = idsOf(doc);
      const { service, bundleModel } = build(doc);

      await service.reorderMedias(PRODUCT_ID, USER_ID, [b, a]);

      expect(doc.status).toBe('available');
      expect(bundleModel.updateMany).not.toHaveBeenCalled();
    });

    it('skips the write when the order is unchanged', async () => {
      const doc = docWithMedias(2);
      const { service } = build(doc);

      const res = await service.reorderMedias(PRODUCT_ID, USER_ID, idsOf(doc));

      expect(res.map((m) => m.id)).toEqual(idsOf(doc));
      expect(doc.save).not.toHaveBeenCalled();
    });

    it('accepts an empty list for a product without medias', async () => {
      const doc = docWithMedias(0);
      const { service } = build(doc);
      await expect(
        service.reorderMedias(PRODUCT_ID, USER_ID, []),
      ).resolves.toEqual([]);
    });

    it.each<[string, (ids: string[]) => unknown]>([
      ['a missing id', ([a, b]) => [a, b]],
      ['a duplicate id', ([a, b]) => [a, b, b]],
      ['a duplicate replacing one id', ([a, b]) => [a, b, a]],
      ['an unknown id', ([a, b]) => [a, b, new Types.ObjectId().toHexString()]],
      ['an extra id', (ids) => [...ids, new Types.ObjectId().toHexString()]],
      ['a non-array body', ([a]) => a],
      ['a missing body', () => undefined],
      ['non-string entries', ([a, b]) => [a, b, 3]],
    ])('rejects %s with invalid_media_order', async (_, build_) => {
      const doc = docWithMedias(3);
      const before = idsOf(doc);
      const { service } = build(doc);

      await expectError(
        service.reorderMedias(PRODUCT_ID, USER_ID, build_(before)),
        'invalid_media_order',
      );
      expect(idsOf(doc)).toEqual(before);
      expect(doc.save).not.toHaveBeenCalled();
    });

    it('rejects malformed ids with invalid_media_id', async () => {
      const doc = docWithMedias(2);
      const [a] = idsOf(doc);
      const { service } = build(doc);
      await expectError(
        service.reorderMedias(PRODUCT_ID, USER_ID, [a, 'not-an-id']),
        'invalid_media_id',
      );
    });

    it('404s for a product owned by another provider', async () => {
      const doc = docWithMedias(2);
      const [a, b] = idsOf(doc);
      const { service } = build(doc);
      await expect(
        service.reorderMedias(PRODUCT_ID, OTHER_USER, [b, a]),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(idsOf(doc)).toEqual([a, b]);
      expect(doc.save).not.toHaveBeenCalled();
    });

    it('404s for a missing product', async () => {
      const { service } = build();
      await expect(
        service.reorderMedias(PRODUCT_ID, USER_ID, []),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('order invariants', () => {
    it('upload appends to the end', async () => {
      const doc = docWithMedias(2);
      const before = idsOf(doc);
      const { service } = build(doc);

      const res = await service.addMedia(PRODUCT_ID, USER_ID, png);

      expect(idsOf(doc)).toEqual([...before, res.id]);
    });

    it('replace keeps the media position', async () => {
      const doc = docWithMedias(3);
      const [a, b, c] = idsOf(doc);
      const { service } = build(doc);

      const res = await service.replaceMedia(PRODUCT_ID, b, USER_ID, png);

      expect(idsOf(doc)).toEqual([a, res.id, c]);
    });

    it('replacing the head keeps it as head', async () => {
      const doc = docWithMedias(2);
      const [a, b] = idsOf(doc);
      const { service } = build(doc);

      const res = await service.replaceMedia(PRODUCT_ID, a, USER_ID, png);

      expect(idsOf(doc)).toEqual([res.id, b]);
    });

    it('deleting the head promotes the next media to head', async () => {
      const doc = docWithMedias(3);
      const [a, b, c] = idsOf(doc);
      const { service } = build(doc);

      await service.deleteMedia(PRODUCT_ID, a, USER_ID);

      expect(idsOf(doc)).toEqual([b, c]);
    });

    it('product detail returns medias in stored order', async () => {
      const doc = docWithMedias(3);
      const [a, b, c] = idsOf(doc);
      const { service } = build(doc);

      await service.reorderMedias(PRODUCT_ID, USER_ID, [b, c, a]);
      const res = await service.findOneByOwner(PRODUCT_ID, USER_ID);

      expect(res.medias.map((m) => m.id)).toEqual([b, c, a]);
    });

    it('product list returns medias in stored order', () => {
      const doc = docWithMedias(3);
      const ids = idsOf(doc).reverse();
      doc.medias.reverse();
      const { service } = build(doc);

      const res = service.toResponse(doc.toObject() as never);

      expect(res.medias.map((m) => m.id)).toEqual(ids);
    });
  });
});
