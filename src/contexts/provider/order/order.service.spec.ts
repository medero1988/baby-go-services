import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { StoreService } from '../store/store.service';
import { OrderService } from './order.service';

const STORE_ID = new Types.ObjectId().toHexString();

function makeOrder(i: number, status = 'pending') {
  return {
    _id: new Types.ObjectId(),
    code: String(3000 + i),
    title: `Product ${i}`,
    startingDate: '2025-07-14',
    endingDate: '2025-07-19',
    timeOfReturn: '14:30',
    price: 1550,
    media: i % 2 ? null : `https://img/${i}.jpg`,
    createdAt: new Date(Date.UTC(2025, 5, 13, 10, 0, i)),
    status,
  };
}

function setup(opts: {
  docs?: ReturnType<typeof makeOrder>[];
  countRows?: { _id: string; count: number }[];
  storeError?: Error;
}) {
  const chain = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn<unknown, [number]>().mockReturnThis(),
    limit: jest.fn<unknown, [number]>().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  };
  const model = {
    find: jest
      .fn<typeof chain, [Record<string, unknown>]>()
      .mockReturnValue(chain),
    aggregate: jest
      .fn<{ exec: jest.Mock }, [Record<string, Record<string, unknown>>[]]>()
      .mockReturnValue({
        exec: jest.fn().mockResolvedValue(opts.countRows ?? []),
      }),
  };
  // Simula skip/limit reales sobre `docs`.
  chain.exec.mockImplementation(() => {
    const skip = chain.skip.mock.calls[0]?.[0] ?? 0;
    const limit = chain.limit.mock.calls[0]?.[0];
    return Promise.resolve((opts.docs ?? []).slice(skip, skip + limit));
  });
  const storeService = {
    getStoreIdForProvider: jest.fn(() =>
      opts.storeError
        ? Promise.reject(opts.storeError)
        : Promise.resolve(STORE_ID),
    ),
  };
  const service = new OrderService(
    model as never,
    storeService as unknown as StoreService,
  );
  return { service, model, chain, storeService };
}

describe('OrderService.listForProvider', () => {
  it('scopes to the provider store, sorts by createdAt desc and maps items', async () => {
    const docs = [makeOrder(1), makeOrder(2, 'accepted')];
    const { service, model, chain, storeService } = setup({
      docs,
      countRows: [
        { _id: 'pending', count: 1 },
        { _id: 'accepted', count: 1 },
      ],
    });

    const res = await service.listForProvider('user-1', {});

    expect(storeService.getStoreIdForProvider).toHaveBeenCalledWith('user-1');
    const filter = model.find.mock.calls[0][0];
    expect(String(filter.storeId)).toBe(STORE_ID);
    expect(filter.status).toBeUndefined();
    expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    expect(chain.skip).toHaveBeenCalledWith(0);
    expect(chain.limit).toHaveBeenCalledWith(21);

    expect(res.data).toEqual([
      {
        id: String(docs[0]._id),
        code: '3001',
        title: 'Product 1',
        startingDate: '2025-07-14',
        endingDate: '2025-07-19',
        timeOfReturn: '14:30',
        price: 15.5,
        media: null,
        creationDate: '2025-06-13T10:00:01.000Z',
        status: 'pending',
      },
      expect.objectContaining({
        media: 'https://img/2.jpg',
        status: 'accepted',
      }),
    ]);
    expect(res.nextPage).toBeNull();
    expect(res.counts).toEqual({
      pending: 1,
      accepted: 1,
      progress: 0,
      cancelled: 0,
      completed: 0,
    });
  });

  it('filters by status list but counts all statuses for the store', async () => {
    const { service, model } = setup({
      countRows: [{ _id: 'completed', count: 4 }],
    });

    const res = await service.listForProvider('user-1', {
      status: 'pending,progress',
    });

    const filter = model.find.mock.calls[0][0];
    expect(filter.status).toEqual({ $in: ['pending', 'progress'] });
    const pipeline = model.aggregate.mock.calls[0][0];
    expect(Object.keys(pipeline[0].$match)).toEqual(['storeId']);
    expect(res.counts.completed).toBe(4);
    expect(res.data).toEqual([]);
    expect(res.nextPage).toBeNull();
  });

  it('returns nextPage when more results exist', async () => {
    const docs = Array.from({ length: 5 }, (_, i) => makeOrder(i));
    const { service } = setup({ docs });

    const first = await service.listForProvider('user-1', { limit: '2' });
    expect(first.data).toHaveLength(2);
    expect(first.nextPage).toEqual({ offset: 2 });
  });

  it('returns nextPage null on the last page', async () => {
    const docs = Array.from({ length: 5 }, (_, i) => makeOrder(i));
    const { service } = setup({ docs });

    const last = await service.listForProvider('user-1', {
      limit: '2',
      offset: '4',
    });
    expect(last.data).toHaveLength(1);
    expect(last.nextPage).toBeNull();
  });

  it('returns nextPage null when exactly `limit` results remain', async () => {
    const docs = Array.from({ length: 4 }, (_, i) => makeOrder(i));
    const { service } = setup({ docs });

    const res = await service.listForProvider('user-1', {
      limit: '2',
      offset: '2',
    });
    expect(res.data).toHaveLength(2);
    expect(res.nextPage).toBeNull();
  });

  it('rejects invalid query before touching the DB', async () => {
    const { service, model, storeService } = setup({});
    await expect(
      service.listForProvider('user-1', { status: 'nope' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.listForProvider('user-1', { limit: '100' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storeService.getStoreIdForProvider).not.toHaveBeenCalled();
    expect(model.find).not.toHaveBeenCalled();
  });

  it('propagates store_not_found (404) when the provider has no store', async () => {
    const { service, model } = setup({
      storeError: new NotFoundException({ error: 'store_not_found' }),
    });
    await expect(service.listForProvider('user-1', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(model.find).not.toHaveBeenCalled();
  });
});
