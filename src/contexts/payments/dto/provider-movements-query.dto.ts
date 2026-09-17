import { IsIn, IsOptional } from 'class-validator';
import { PaymentStatus } from '../payment.types';

const PAYMENT_STATUSES: PaymentStatus[] = [
  'requires_payment_method',
  'requires_confirmation',
  'requires_action',
  'processing',
  'succeeded',
  'failed',
  'canceled',
  'transferred',
  'refunded',
];

export class ProviderMovementsQueryDto {
  /** Filtra por estado del pago. */
  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  status?: PaymentStatus;
}
