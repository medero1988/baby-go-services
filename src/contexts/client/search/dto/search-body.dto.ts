import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class SearchDestinationDto {
  /** Código o nombre de país de la store (`store.country`). */
  @IsString()
  @MinLength(1)
  country: string;

  /**
   * No hay campo city en la store: se busca dentro de `address.addressLine1/2`.
   */
  @IsOptional()
  @IsString()
  @MinLength(1)
  city?: string;
}

export class SearchCategoryDto {
  /** Id de categoría del taxonomy (`stroller`, `bike`, `crib`, …). */
  @IsString()
  @MinLength(1)
  name: string;

  /**
   * Valores de atributos de tipo select que describen el ítem
   * (`type`, `style`, `eceGroup`, `frameType`, `boxType`, `size`).
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  types?: string[];

  /** Valores de `attributes.accessories` (match si el producto tiene alguno). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  accessories?: string[];
}

export class SearchRentalPeriodDto {
  @IsDateString()
  start: string;

  @IsDateString()
  end: string;
}

export class SearchHandoffDto {
  @IsIn(['delivery', 'customer_pickup'])
  type: 'delivery' | 'customer_pickup';

  /** Aceptado en el contrato; todavía no filtra por distancia. */
  @IsOptional()
  @IsString()
  address?: string;

  /** Minutos desde las 00:00. Se cruza con `timeRanges` de la store. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  time?: number;
}

export class SearchBodyDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => SearchDestinationDto)
  destination?: SearchDestinationDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SearchCategoryDto)
  categories?: SearchCategoryDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => SearchRentalPeriodDto)
  rentalPeriod?: SearchRentalPeriodDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SearchHandoffDto)
  acquisition?: SearchHandoffDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SearchHandoffDto)
  devolution?: SearchHandoffDto;
}
