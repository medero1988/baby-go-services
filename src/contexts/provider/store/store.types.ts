/**
 * Tipos del funnel de creación de tienda y estado de la tienda.
 */
export type FunnelLastSteep =
  | 'profile'
  | 'cell-verification'
  | 'avatar'
  | 'delivery'
  | 'delivery-pricing'
  | 'customer-pickup'
  | 'bank-account';

export type StoreState = 'missing-info' | 'pending-review' | 'active';

export interface StoreFunnelMeta {
  state: StoreState;
  lastSteep: FunnelLastSteep;
  cellValidated: boolean;
}

/** Dirección de la tienda (Google Places). */
export interface StoreAddress {
  addressLine1: string;
  addressLine2?: string;
  placeId: string;
}

/** Días de la semana → índices en `timeRanges`. */
export type DeliveryDayKey =
  | 'mon'
  | 'tue'
  | 'wed'
  | 'thu'
  | 'fri'
  | 'sat'
  | 'sun';

export type DeliveryDaysMap = Partial<Record<DeliveryDayKey, number[]>>;

/**
 * Horario de atención para delivery (refinado en funnel).
 * `days.*` son índices hacia el array `timeRanges`.
 */
export interface AttentionSchedule {
  available: boolean;
  /** Si true, el horario es 24/7 y no aplica configuración por días. */
  available24h?: boolean;
  timeRanges: string[];
  days?: DeliveryDaysMap;
  /** Precio base mínimo en centavos. */
  basePrice?: number;
  /** Tarifa por km en centavos. */
  pricePerKm?: number;
  /** Distancia máxima de delivery en km. */
  maxDeliveryDistance?: number;
}

/** Respuesta de creación de perfil de tienda */
export interface StoreProfileResponse {
  id: string;
  userId: string;
  name: string;
  avatar?: string;
  country: string;
  address: StoreAddress;
  cellPhone: string;
  /** Horario de delivery (si ya fue configurado). */
  delivery?: AttentionSchedule;
  meta: StoreFunnelMeta;
  /** Solo en desarrollo: código enviado para verificación (para pruebas). */
  devCode?: string;
}
