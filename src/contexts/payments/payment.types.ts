import { StripeConnectStatus } from '../provider/store/store.types';

export type PaymentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'transferred'
  | 'refunded';

export interface PaymentResponse {
  id: string;
  userId: string;
  storeId: string;
  orderId?: string;
  stripePaymentIntentId: string;
  amount: number;
  providerAmount: number;
  platformFeeAmount: number;
  currency: string;
  status: PaymentStatus;
  stripeTransferId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentIntentResponse {
  payment: PaymentResponse;
  clientSecret: string;
  publishableKey: string;
}

/** Movimiento de pago visto desde el proveedor (dueño de la store). */
export interface ProviderMovement {
  id: string;
  storeId: string;
  storeName: string;
  orderId?: string;
  /** Monto total pagado por el cliente (centavos). */
  amount: number;
  /** Parte que corresponde al proveedor (centavos). */
  providerAmount: number;
  /** Comisión retenida por la plataforma (centavos). */
  platformFeeAmount: number;
  currency: string;
  status: PaymentStatus;
  /** true cuando los fondos ya fueron transferidos al proveedor. */
  transferred: boolean;
  stripeTransferId?: string;
  stripePaymentIntentId: string;
  createdAt: string;
  updatedAt: string;
}

/** Totales agregados de los movimientos del proveedor (en centavos). */
export interface ProviderMovementsSummary {
  totalMovements: number;
  currency: string;
  /** Total cobrado a clientes (pagos succeeded + transferred). */
  collected: number;
  /** Ganancias ya transferidas al proveedor. */
  earningsTransferred: number;
  /** Ganancias cobradas pero pendientes de transferir. */
  earningsPending: number;
  /** Comisión total retenida por la plataforma. */
  platformFees: number;
}

export interface ProviderMovementsResponse {
  summary: ProviderMovementsSummary;
  movements: ProviderMovement[];
}

export interface AccountLinkResponse {
  url: string;
  expiresAt: number;
  stripeConnect: StripeConnectStatus;
}

export type { StripeConnectStatus };
