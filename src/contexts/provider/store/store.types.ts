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
  | 'bank-account'
  | 'confirmation';

export type StoreState = 'missing-info' | 'pending-review' | 'active';

export interface StoreFunnelMeta {
  state: StoreState;
  lastSteep: FunnelLastSteep;
  cellValidated: boolean;
  /** Timestamp ISO cuando el provider confirmó / envió a revisión. */
  confirmedAt?: string;
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

/** Horario de atención (delivery o customer pickup). */
export interface ServiceSchedule {
  available: boolean;
  available24h?: boolean;
  timeRanges: string[];
  days?: DeliveryDaysMap;
}

/**
 * Horario de delivery + tarifas opcionales.
 * `days.*` son índices hacia el array `timeRanges`.
 */
export interface AttentionSchedule extends ServiceSchedule {
  /** Precio base mínimo en centavos. */
  basePrice?: number;
  /** Tarifa por km en centavos. */
  pricePerKm?: number;
  /** Distancia máxima de delivery en km. */
  maxDeliveryDistance?: number;
}

/** Horario de retiro en tienda (customer pickup). */
export type PickupSchedule = ServiceSchedule;

/** Stripe Connect Express — onboarding bancario del provider. */
export interface StripeConnectStatus {
  accountId?: string;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

/**
 * Datos bancarios (payout) de la store.
 * No persistimos IBAN/nro de cuenta completo: guardamos metadata + `last4`
 * y el token/id de Stripe como referencia segura.
 */
export interface StoreBankAccount {
  accountType: 'IBAN' | 'NUMBER';
  holderName: string;
  entityType: 'individual' | 'company';
  country: string;
  currency: string;
  bankName: string;
  /** Últimos 4 dígitos del IBAN / número de cuenta. */
  last4?: string;
  swiftCode?: string;
  address?: string;
  /** Token de Stripe (btok_...) generado con los datos bancarios. */
  token: string;
  /** Id de la cuenta externa en Stripe Connect (ba_...), si fue adjuntada. */
  externalAccountId?: string;
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
  /** Horario de retiro en tienda (customer pickup). */
  customerPickup?: PickupSchedule;
  /** Cuenta Stripe Connect del provider. */
  stripeConnect?: StripeConnectStatus;
  /** Datos bancarios (payout) de la store. */
  bankAccount?: StoreBankAccount;
  /** Token/id de la cuenta bancaria en Stripe (referencia rápida para el front). */
  bankAccountTk?: string;
  meta: StoreFunnelMeta;
  /** Solo en desarrollo: código enviado para verificación (para pruebas). */
  devCode?: string;
}
