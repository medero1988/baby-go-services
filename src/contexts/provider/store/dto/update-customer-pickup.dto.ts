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

/** Índices por día hacia `timeRanges` (máx. 2 intervalos por día en UI). */
export class CustomerPickupDaysDto {
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

export class UpdateCustomerPickupDto {
  @IsBoolean()
  available: boolean;

  @IsOptional()
  @IsBoolean()
  available24h?: boolean;

  @ValidateIf((o: { available24h?: boolean }) => o.available24h !== true)
  @IsArray()
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  timeRanges?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerPickupDaysDto)
  days?: CustomerPickupDaysDto;
}
