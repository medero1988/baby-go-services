import { SearchService } from './search.service';

type Filters = {
  productFilter(storeIds: null, categories: unknown[]): Record<string, unknown>;
  bundleFilter(storeIds: null, categories: unknown[]): Record<string, unknown>;
};

describe('SearchService filters', () => {
  const service = new SearchService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  ) as unknown as Filters;

  it('only shows available products to customers', () => {
    expect(service.productFilter(null, [])).toEqual({ status: 'available' });
  });

  it('only shows available bundles to customers', () => {
    expect(service.bundleFilter(null, [])).toEqual({ status: 'available' });
  });
});

describe('SearchService medias order', () => {
  type Mappers = {
    toProductItem(product: unknown, stores: Map<string, unknown>): unknown;
    toBundleItem(
      bundle: unknown,
      members: Map<string, unknown>,
      stores: Map<string, unknown>,
    ): unknown;
  };
  const service = new SearchService(
    {} as never,
    {} as never,
    {} as never,
    { imageUrls: jest.fn(() => ({})) } as never,
  ) as unknown as Mappers;
  const stores = new Map([['s1', { _id: 's1', name: 'Store' }]]);
  const product = (id: string, mediaIds: string[]) => ({
    _id: id,
    storeId: 's1',
    title: id,
    medias: mediaIds.map((m) => ({ _id: m, url: `https://x/${m}.jpg` })),
  });
  const ids = (item: unknown) =>
    (item as { medias: { id: string }[] }).medias.map((m) => m.id);

  it('returns product medias in stored order (head first)', () => {
    const item = service.toProductItem(product('p1', ['c', 'a', 'b']), stores);
    expect(ids(item)).toEqual(['c', 'a', 'b']);
  });

  it('uses each member head (medias[0]) for bundle medias', () => {
    const members = new Map([
      ['p1', product('p1', ['b', 'a'])],
      ['p2', product('p2', ['d', 'c'])],
    ]);
    const item = service.toBundleItem(
      { _id: 'b1', storeId: 's1', productIds: ['p1', 'p2'] },
      members,
      stores,
    );
    expect(ids(item)).toEqual(['b', 'd']);
  });
});
