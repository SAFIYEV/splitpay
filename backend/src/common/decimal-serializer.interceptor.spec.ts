import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { serializeDecimals } from './decimal-serializer.interceptor';

describe('serializeDecimals', () => {
  it('converts a top-level Decimal to a number', () => {
    expect(serializeDecimals(new Prisma.Decimal('50.000000'))).toBe(50);
  });

  it('converts Decimals in nested objects and arrays', () => {
    const payload = {
      id: 'abc',
      amount: new Prisma.Decimal('12.345678'),
      splits: [
        { userId: 'u1', amount: new Prisma.Decimal('6.172839') },
        { userId: 'u2', amount: new Prisma.Decimal('6.172839') },
      ],
      group: { totalSpent: new Prisma.Decimal('99.5') },
    };
    expect(serializeDecimals(payload)).toEqual({
      id: 'abc',
      amount: 12.345678,
      splits: [
        { userId: 'u1', amount: 6.172839 },
        { userId: 'u2', amount: 6.172839 },
      ],
      group: { totalSpent: 99.5 },
    });
  });

  it('preserves Date instances untouched', () => {
    const date = new Date('2026-10-10T00:00:00.000Z');
    const result = serializeDecimals({ createdAt: date }) as {
      createdAt: Date;
    };
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.createdAt.getTime()).toBe(date.getTime());
  });

  it('preserves null and undefined', () => {
    const payload = { avatar: null, notes: undefined };
    const result = serializeDecimals(payload) as Record<string, unknown>;
    expect(result.avatar).toBeNull();
    expect('notes' in result && result.notes === undefined).toBe(true);
    expect(serializeDecimals(null)).toBeNull();
    expect(serializeDecimals(undefined)).toBeUndefined();
  });

  it('passes primitives through unchanged', () => {
    expect(serializeDecimals('hello')).toBe('hello');
    expect(serializeDecimals(42)).toBe(42);
    expect(serializeDecimals(true)).toBe(true);
  });

  it('keeps pagination-style wrappers intact', () => {
    const payload = {
      data: [{ amount: new Prisma.Decimal('1.5') }],
      meta: { total: 1, page: 1 },
    };
    expect(serializeDecimals(payload)).toEqual({
      data: [{ amount: 1.5 }],
      meta: { total: 1, page: 1 },
    });
  });

  it('handles empty arrays and objects', () => {
    expect(serializeDecimals([])).toEqual([]);
    expect(serializeDecimals({})).toEqual({});
  });
});
