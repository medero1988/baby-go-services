import { IsInt, Min } from 'class-validator';

export class UpdateDeliveryPricingDto {
  /** Precio base mínimo en centavos (ej. 100 = €1.00). */
  @IsInt()
  @Min(0)
  basePrice: number;

  /** Tarifa por km en centavos (ej. 30 = €0.30/km). */
  @IsInt()
  @Min(0)
  priceKm: number;

  /** Distancia máxima de delivery en km. */
  @IsInt()
  @Min(1)
  maxDeliveryDistance: number;
}
