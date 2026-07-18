import { IsInt, IsMongoId, IsOptional, IsString, Min } from 'class-validator';

export class CreatePaymentIntentDto {
  @IsMongoId()
  storeId: string;

  /** Monto total en centavos (lo que paga el cliente). */
  @IsInt()
  @Min(50)
  amount: number;

  @IsOptional()
  @IsString()
  orderId?: string;

  /** ISO currency (default desde env, ej. eur). */
  @IsOptional()
  @IsString()
  currency?: string;
}
