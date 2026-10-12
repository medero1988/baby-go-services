import { CartHandoffType } from './cart.schema';

export type CartMoney = {
  currency: 'EUR';
  amount: number;
};

export type CartHandoffResponse = {
  type: CartHandoffType;
  address?: string;
  time?: number;
};

export type CartLineKind = 'product' | 'bundle';

export type CartLineResponse = {
  kind: CartLineKind;
  id: string;
  title: string;
  /** Precio por día (oferta vigente o lista). En bundles es el precio del combo. */
  price: CartMoney;
  /** price × días del alquiler. */
  lineTotal: CartMoney;
  media: string | null;
  accessories: string[];
  selectedAccessories: string[];
  isAvailable: boolean;
  /** Solo bundles: productos que incluye el combo. */
  products?: { id: string; title: string; category: string }[];
};

export type CartStoreResponse = {
  storeId: string;
  storeName: string;
  acquisition: CartHandoffResponse;
  devolution: CartHandoffResponse;
  products: CartLineResponse[];
  itemsTotal: CartMoney;
  deliveryCost: CartMoney;
  total: CartMoney;
};

export type CartTotals = {
  currency: 'EUR';
  days: number;
  /** Suma de los lineTotal, en euros. */
  itemsAmount: number;
  deliveryAmount: number;
  taxAmount: number;
  /** itemsAmount + deliveryAmount + taxAmount. */
  amount: number;
};

export type CartResponse = {
  city: string | null;
  country: string | null;
  tax: CartMoney;
  /** Días inclusivos del período (30/06–02/07 = 3). 0 si no hay período. */
  days: number;
  rentalPeriod: { start: string; end: string } | null;
  productsByStore: CartStoreResponse[];
  totals: CartTotals;
};

export type CartCountResponse = {
  count: number;
};
