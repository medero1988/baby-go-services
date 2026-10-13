import { BadRequestException } from '@nestjs/common';
import { ListProviderOrdersQueryDto } from './dto/list-provider-orders-query.dto';
import {
  ORDER_STATUSES,
  OrderStatus,
  OrderStatusCounts,
  ProviderOrdersQuery,
} from './order.types';

export const DEFAULT_ORDERS_LIMIT = 20;
export const MAX_ORDERS_LIMIT = 50;

const INT_RE = /^\d+$/;

/** Valida/normaliza el query de GET /provider-orders. */
export function parseProviderOrdersQuery(
  query: ListProviderOrdersQueryDto = {},
): ProviderOrdersQuery {
  return {
    statuses: parseStatuses(query.status),
    limit: parseIntParam(
      query.limit,
      'limit',
      DEFAULT_ORDERS_LIMIT,
      1,
      MAX_ORDERS_LIMIT,
    ),
    offset: parseIntParam(query.offset, 'offset', 0, 0),
  };
}

function parseStatuses(raw: string | undefined): OrderStatus[] {
  if (raw === undefined) return [];
  const values = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (!values.length) {
    throw invalidStatus(raw);
  }
  const invalid = values.filter(
    (v) => !(ORDER_STATUSES as readonly string[]).includes(v),
  );
  if (invalid.length) {
    throw invalidStatus(invalid.join(','));
  }
  return [...new Set(values as OrderStatus[])];
}

function invalidStatus(value: string): BadRequestException {
  return new BadRequestException({
    error: 'invalid_status',
    message: `Invalid status "${value}". Allowed: ${ORDER_STATUSES.join(', ')}`,
  });
}

function parseIntParam(
  raw: string | undefined,
  field: 'limit' | 'offset',
  fallback: number,
  min: number,
  max?: number,
): number {
  if (raw === undefined) return fallback;
  const value = raw.trim();
  const n = INT_RE.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(n) || n < min || (max !== undefined && n > max)) {
    throw new BadRequestException({
      error: `invalid_${field}`,
      message:
        max !== undefined
          ? `${field} must be an integer between ${min} and ${max}`
          : `${field} must be an integer >= ${min}`,
    });
  }
  return n;
}

/** Cents (entero) -> unidades (1550 -> 15.5). */
export function centsToUnits(cents: number): number {
  return Math.round(cents) / 100;
}

/** Counts con las 5 claves siempre presentes. */
export function buildStatusCounts(
  rows: { _id: string; count: number }[],
): OrderStatusCounts {
  const counts = Object.fromEntries(
    ORDER_STATUSES.map((s) => [s, 0]),
  ) as OrderStatusCounts;
  for (const row of rows) {
    if ((ORDER_STATUSES as readonly string[]).includes(row._id)) {
      counts[row._id as OrderStatus] = row.count;
    }
  }
  return counts;
}
