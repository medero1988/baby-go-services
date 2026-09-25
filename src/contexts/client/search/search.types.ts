import {
  ProductMediaUrls,
  ProductPrice,
} from '../../provider/product/product.types';
import {
  DeliveryDaysMap,
  StoreAddress,
} from '../../provider/store/store.types';

export type SearchKind = 'product' | 'bundle';

export type SearchFulfillment = {
  available: boolean;
  available24h?: boolean;
  timeRanges: string[];
  days?: DeliveryDaysMap;
};

export type SearchStoreSummary = {
  id: string;
  name: string;
  country: string;
  address: StoreAddress;
  delivery?: SearchFulfillment;
  customerPickup?: SearchFulfillment;
};

export type SearchMedia = {
  id: string;
  url: string;
  urls: ProductMediaUrls;
};

export type SearchBundleProduct = {
  id: string;
  title: string;
  category: string;
};

export type SearchItem = {
  kind: SearchKind;
  id: string;
  title: string;
  description: string;
  /** Producto: un id. Combo: `['bundle', ...categorías]`. */
  category: string | string[];
  price: ProductPrice;
  /** Solo productos. */
  attributes?: Record<string, unknown>;
  /** Solo combos: productos que lo componen. */
  products?: SearchBundleProduct[];
  medias: SearchMedia[];
  store: SearchStoreSummary;
};

export type SearchNextPage = {
  offset: number;
  limit: number;
};

export type SearchResponse = {
  data: SearchItem[];
  total: number;
  /** null cuando no hay más resultados. */
  nextPage: SearchNextPage | null;
};
