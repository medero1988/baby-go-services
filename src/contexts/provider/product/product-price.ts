import { BadRequestException } from '@nestjs/common';
import { UpdateProductPriceDto } from './dto/update-product.dto';
import { ProductPrice } from './product.types';

export function hasPricePatch(patch: UpdateProductPriceDto): boolean {
  return (
    patch.list !== undefined ||
    patch.offer !== undefined ||
    patch.activeFrom !== undefined ||
    patch.activeUntil !== undefined
  );
}

export function normalizePrice(dto: {
  list: number;
  offer?: number;
  activeFrom?: string;
  activeUntil?: string;
}): ProductPrice {
  if (dto.offer !== undefined && dto.offer > dto.list) {
    throw new BadRequestException({
      error: 'invalid_offer_price',
      message: 'offer must be less than or equal to list price',
    });
  }

  const price: ProductPrice = { list: dto.list };

  if (dto.offer !== undefined) {
    price.offer = dto.offer;
    price.activeFrom = normalizeDateInput(dto.activeFrom!, 'activeFrom');
    price.activeUntil = normalizeDateInput(dto.activeUntil!, 'activeUntil');
    if (price.activeUntil < price.activeFrom) {
      throw new BadRequestException({
        error: 'invalid_offer_dates',
        message: 'activeUntil must be on or after activeFrom',
      });
    }
  }

  return price;
}

export function mergePrice(
  current: ProductPrice | undefined,
  patch: UpdateProductPriceDto,
): ProductPrice {
  const list = patch.list ?? current?.list;
  if (typeof list !== 'number' || !Number.isFinite(list)) {
    throw new BadRequestException({
      error: 'price_required',
      message: 'price.list is required',
    });
  }

  if (patch.offer === null) {
    return { list };
  }

  const merged: {
    list: number;
    offer?: number;
    activeFrom?: string;
    activeUntil?: string;
  } = { list };

  const offer = patch.offer ?? current?.offer;
  if (offer !== undefined) {
    merged.offer = offer;
    merged.activeFrom = patch.activeFrom ?? current?.activeFrom;
    merged.activeUntil = patch.activeUntil ?? current?.activeUntil;
  }

  return normalizePrice(merged);
}

/** Acepta YYYY-MM-DD o DD/MM/YYYY. Guarda ISO date YYYY-MM-DD. */
function normalizeDateInput(value: string, field: string): string {
  const raw = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/;
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

  let y: number;
  let m: number;
  let d: number;

  const isoMatch = raw.match(iso);
  const dmyMatch = raw.match(dmy);
  if (isoMatch) {
    y = Number(isoMatch[1]);
    m = Number(isoMatch[2]);
    d = Number(isoMatch[3]);
  } else if (dmyMatch) {
    d = Number(dmyMatch[1]);
    m = Number(dmyMatch[2]);
    y = Number(dmyMatch[3]);
  } else {
    throw new BadRequestException({
      error: 'invalid_date',
      field,
      message: 'Use YYYY-MM-DD or DD/MM/YYYY',
    });
  }

  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    throw new BadRequestException({ error: 'invalid_date', field });
  }

  return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
}
