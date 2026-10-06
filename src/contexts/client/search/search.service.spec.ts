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

  it('keeps bundles on their own active status', () => {
    expect(service.bundleFilter(null, [])).toEqual({ status: 'active' });
  });
});
