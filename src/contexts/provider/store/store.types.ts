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
  cellValidationSent: boolean;
}

/** Respuesta de creación de perfil de tienda */
export interface StoreProfileResponse {
  id: string;
  userId: string;
  name: string;
  country: string;
  address: string;
  cellPhone: string;
  meta: StoreFunnelMeta;
}
