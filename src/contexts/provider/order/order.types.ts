export const ORDER_STATUSES = [
  'pending',
  'accepted',
  'progress',
  'cancelled',
  'completed',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderStatusCounts = Record<OrderStatus, number>;

/** Item de GET /provider-orders. `price` en unidades (cents / 100). */
export type ProviderOrderListItem = {
  id: string;
  code: string;
  title: string;
  /** YYYY-MM-DD */
  startingDate: string;
  /** YYYY-MM-DD */
  endingDate: string;
  /** HH:mm (24h) */
  timeOfReturn: string;
  price: number;
  media: string | null;
  /** ISO date-time (createdAt). */
  creationDate: string;
  status: OrderStatus;
};

export type ProviderOrderListResponse = {
  data: ProviderOrderListItem[];
  nextPage: { offset: number } | null;
  counts: OrderStatusCounts;
};

export type ProviderOrdersQuery = {
  statuses: OrderStatus[];
  limit: number;
  offset: number;
};
