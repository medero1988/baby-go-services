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

/**
 * Stripe Connect — onboarding hosted del provider (KYC + cuenta bancaria).
 * Los datos bancarios viven solo en Stripe; nunca pasan por nuestra API.
 */
export interface StripeConnectStatus {
  accountId?: string;
  /** Puede recibir transfers y Stripe puede pagarle a su banco. */
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  /** Capability `transfers` activa en Stripe. */
  transfersEnabled: boolean;
  /** El provider terminó el formulario de onboarding de Stripe. */
  detailsSubmitted: boolean;
}

/** Avatar persistido (Cloudinary / storage). */
export interface StoreAvatar {
  url: string;
  publicId?: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
}

export type StoreAvatarUrls = {
  original: string;
  thumbnail: string;
  card: string;
  detail: string;
};

/** Avatar en respuestas API (incluye vistas derivadas). */
export type StoreAvatarResponse = {
  url: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
  urls: StoreAvatarUrls;
};

/** Respuesta de creación de perfil de tienda */
export interface StoreProfileResponse {
  id: string;
  userId: string;
  name: string;
  /** Avatar con URL original + vistas (mismo patrón que product medias). */
  avatar?: StoreAvatarResponse;
  country: string;
  address: StoreAddress;
  cellPhone: string;
  /** Horario de delivery (si ya fue configurado). */
  delivery?: AttentionSchedule;
  /** Horario de retiro en tienda (customer pickup). */
  customerPickup?: PickupSchedule;
  /** Cuenta Stripe Connect del provider. */
  stripeConnect?: StripeConnectStatus;
  meta: StoreFunnelMeta;
  /** Solo en desarrollo: código enviado para verificación (para pruebas). */
  devCode?: string;
}
