import { BadRequestException } from '@nestjs/common';
import {
  buildStatusCounts,
  centsToUnits,
  parseProviderOrdersQuery,
} from './order-query';

function errorOf(fn: () => unknown): Record<string, unknown> {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(BadRequestException);
    return (e as BadRequestException).getResponse() as Record<string, unknown>;
  }
  throw new Error('expected BadRequestException');
}

describe('parseProviderOrdersQuery', () => {
  it('applies defaults', () => {
    expect(parseProviderOrdersQuery({})).toEqual({
      statuses: [],
      limit: 20,
      offset: 0,
    });
    expect(parseProviderOrdersQuery()).toEqual({
      statuses: [],
      limit: 20,
      offset: 0,
    });
  });

  it('parses a single status and a comma-separated list (deduped, trimmed)', () => {
    expect(parseProviderOrdersQuery({ status: 'pending' }).statuses).toEqual([
      'pending',
    ]);
    expect(
      parseProviderOrdersQuery({ status: 'pending, accepted,pending' })
        .statuses,
    ).toEqual(['pending', 'accepted']);
  });

  it('rejects unknown or empty status with invalid_status', () => {
    expect(
      errorOf(() => parseProviderOrdersQuery({ status: 'pending,foo' })),
    ).toMatchObject({ error: 'invalid_status' });
    expect(
      errorOf(() => parseProviderOrdersQuery({ status: '' })),
    ).toMatchObject({ error: 'invalid_status' });
    expect(
      errorOf(() => parseProviderOrdersQuery({ status: 'PENDING' })),
    ).toMatchObject({ error: 'invalid_status' });
  });

  it('parses limit and offset', () => {
    expect(parseProviderOrdersQuery({ limit: '1', offset: '40' })).toEqual({
      statuses: [],
      limit: 1,
      offset: 40,
    });
    expect(parseProviderOrdersQuery({ limit: '50' }).limit).toBe(50);
  });

  it.each(['0', '51', '-1', 'abc', '1.5', '', '1e1'])(
    'rejects limit=%p with invalid_limit',
    (limit) => {
      expect(errorOf(() => parseProviderOrdersQuery({ limit }))).toMatchObject({
        error: 'invalid_limit',
      });
    },
  );

  it.each(['-1', 'abc', '2.5', ''])(
    'rejects offset=%p with invalid_offset',
    (offset) => {
      expect(errorOf(() => parseProviderOrdersQuery({ offset }))).toMatchObject(
        { error: 'invalid_offset' },
      );
    },
  );
});

describe('centsToUnits', () => {
  it('converts cents to whole currency units', () => {
    expect(centsToUnits(1550)).toBe(15.5);
    expect(centsToUnits(0)).toBe(0);
    expect(centsToUnits(1999)).toBe(19.99);
    expect(centsToUnits(100)).toBe(1);
  });
});

describe('buildStatusCounts', () => {
  it('always returns all five keys, 0 by default', () => {
    expect(buildStatusCounts([])).toEqual({
      pending: 0,
      accepted: 0,
      progress: 0,
      cancelled: 0,
      completed: 0,
    });
  });

  it('fills counts from aggregate rows and ignores unknown statuses', () => {
    expect(
      buildStatusCounts([
        { _id: 'pending', count: 2 },
        { _id: 'accepted', count: 1 },
        { _id: 'weird', count: 9 },
      ]),
    ).toEqual({
      pending: 2,
      accepted: 1,
      progress: 0,
      cancelled: 0,
      completed: 0,
    });
  });
});
