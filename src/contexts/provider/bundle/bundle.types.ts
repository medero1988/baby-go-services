import { ProductPrice, ProductResponse } from '../product/product.types';

export type BundleStatus = 'draft' | 'active' | 'inactive';

export type BundleResponse = {
  id: string;
  storeId: string;
  userId: string;
  products: ProductResponse[];
  title: string;
  description: string;
  price: ProductPrice;
  /** Siempre empieza con `bundle`, más las categorías de los productos. */
  category: string[];
  status: BundleStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type BundleListResponse = {
  items: BundleResponse[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
