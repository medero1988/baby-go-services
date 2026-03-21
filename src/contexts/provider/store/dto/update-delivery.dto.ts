import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

/** Índices por día hacia `timeRanges` (máx. 3 intervalos por día en UI). */
export class DeliveryDaysDto {
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  mon?: number[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  tue?: number[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  wed?: number[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  thu?: number[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  fri?: number[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  sat?: number[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  sun?: number[];
}

export class UpdateDeliveryDto {
  /** Si el delivery está activo para esta tienda. */
  @IsBoolean()
  available: boolean;

  /**
   * Si está marcado, no aplica horario por días (24/7).
   * En ese caso `timeRanges` y `days` pueden ir vacíos u omitirse.
   */
  @IsOptional()
  @IsBoolean()
  available24h?: boolean;

  /** Rangos horarios únicos, ej. `["7:30-9:30", "12:30-14:00"]`. Omitir si `available24h` es true. */
  @ValidateIf((o: { available24h?: boolean }) => o.available24h !== true)
  @IsArray()
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  timeRanges?: string[];

  /**
   * Por cada día, índices en `timeRanges` que aplican ese día.
   * Ej. `mon: [0, 1, 2]` usa los tres primeros rangos el lunes.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => DeliveryDaysDto)
  days?: DeliveryDaysDto;
}
