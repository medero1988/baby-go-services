import { Equals, IsBoolean } from 'class-validator';

/**
 * Confirmación final del funnel de store (botón "Create store").
 * El provider acepta T&Cs y envía la tienda a revisión.
 */
export class ConfirmStoreDto {
  /** Debe ser true: acepta Terms and Conditions de Baby Go. */
  @IsBoolean()
  @Equals(true, {
    message: 'acceptedTerms must be true to confirm the store',
  })
  acceptedTerms: boolean;
}
