import { describe, expect, it } from 'vitest';
import {
  calculateSettlements,
  computeBalances,
  splitEqually,
} from './settlement-engine';

const U = (n: number) => BigInt(n) * 1_000_000n; // n USDC in micro-units

describe('settlement engine', () => {
  describe('calculateSettlements', () => {
    it('returns no transfers for empty balances', () => {
      expect(calculateSettlements(new Map())).toEqual([]);
    });

    it('returns no transfers when all balances are zero', () => {
      const balances = new Map([
        ['alice', 0n],
        ['bob', 0n],
      ]);
      expect(calculateSettlements(balances)).toEqual([]);
    });

    it('produces a single transfer for one debtor and one creditor', () => {
      const balances = new Map([
        ['alice', U(30)],
        ['bob', U(-30)],
      ]);
      expect(calculateSettlements(balances)).toEqual([
        { fromUserId: 'bob', toUserId: 'alice', amount: U(30) },
      ]);
    });

    it('minimizes transfers with multiple creditors and debtors', () => {
      const balances = new Map([
        ['alice', U(60)],
        ['bob', U(40)],
        ['carol', U(-70)],
        ['dave', U(-30)],
      ]);
      const transfers = calculateSettlements(balances);

      // largest debtor (carol, 70) pays largest creditor (alice, 60) then bob 10;
      // dave pays bob 30
      expect(transfers).toEqual([
        { fromUserId: 'carol', toUserId: 'alice', amount: U(60) },
        { fromUserId: 'carol', toUserId: 'bob', amount: U(10) },
        { fromUserId: 'dave', toUserId: 'bob', amount: U(30) },
      ]);

      // every transfer moves money debtor -> creditor and balances reach zero
      expect(transfers.length).toBeLessThanOrEqual(3); // n-1 bound
    });

    it('is deterministic when balances tie', () => {
      const balances = new Map([
        ['zed', U(-10)],
        ['amy', U(-10)],
        ['mike', U(20)],
      ]);
      const first = calculateSettlements(balances);
      const second = calculateSettlements(new Map(balances));
      expect(first).toEqual(second);
      expect(first).toEqual([
        { fromUserId: 'amy', toUserId: 'mike', amount: U(10) },
        { fromUserId: 'zed', toUserId: 'mike', amount: U(10) },
      ]);
    });

    it('handles single micro-unit amounts without float errors', () => {
      const balances = new Map([
        ['alice', 1n],
        ['bob', -1n],
      ]);
      expect(calculateSettlements(balances)).toEqual([
        { fromUserId: 'bob', toUserId: 'alice', amount: 1n },
      ]);
    });
  });

  describe('computeBalances', () => {
    it('returns an empty map for no expenses', () => {
      expect(computeBalances([])).toEqual(new Map());
    });

    it('balances a single expense split equally between two users', () => {
      const balances = computeBalances([
        {
          paidById: 'alice',
          amount: U(100),
          splits: [
            { userId: 'alice', amount: U(50) },
            { userId: 'bob', amount: U(50) },
          ],
        },
      ]);
      expect(balances.get('alice')).toBe(U(50));
      expect(balances.get('bob')).toBe(U(-50));
    });

    it('sums balances to zero across several expenses', () => {
      const expenses = [
        {
          paidById: 'alice',
          amount: U(90),
          splits: [
            { userId: 'alice', amount: U(30) },
            { userId: 'bob', amount: U(30) },
            { userId: 'carol', amount: U(30) },
          ],
        },
        {
          paidById: 'bob',
          amount: U(20),
          splits: [
            { userId: 'alice', amount: U(10) },
            { userId: 'bob', amount: U(10) },
          ],
        },
      ];
      const balances = computeBalances(expenses);
      const total = [...balances.values()].reduce((a, b) => a + b, 0n);
      expect(total).toBe(0n);
      expect(balances.get('alice')).toBe(U(50));
      expect(balances.get('bob')).toBe(U(-20));
      expect(balances.get('carol')).toBe(U(-30));
    });

    it('offsets balances by completed settlements', () => {
      const expenses = [
        {
          paidById: 'alice',
          amount: U(100),
          splits: [
            { userId: 'alice', amount: U(50) },
            { userId: 'bob', amount: U(50) },
          ],
        },
      ];
      const completed = [
        { fromUserId: 'bob', toUserId: 'alice', amount: U(50) },
      ];
      const balances = computeBalances(expenses, completed);
      expect(balances.get('alice')).toBe(0n);
      expect(balances.get('bob')).toBe(0n);
      expect(calculateSettlements(balances)).toEqual([]);
    });
  });

  describe('splitEqually', () => {
    it('splits evenly when the total divides', () => {
      expect(splitEqually(U(90), 3)).toEqual([U(30), U(30), U(30)]);
    });

    it('distributes the micro-unit remainder to the first shares', () => {
      // 10 USDC across 3 members: 3.333334, 3.333333, 3.333333
      const parts = splitEqually(U(10), 3);
      expect(parts).toEqual([3_333_334n, 3_333_333n, 3_333_333n]);
      expect(parts.reduce((a, b) => a + b, 0n)).toBe(U(10));
    });

    it('handles a 1 micro-unit remainder across many shares', () => {
      const parts = splitEqually(1n, 4);
      expect(parts).toEqual([1n, 0n, 0n, 0n]);
      expect(parts.reduce((a, b) => a + b, 0n)).toBe(1n);
    });

    it('rounds 0.1 USDC split three ways without losing units', () => {
      const parts = splitEqually(100_000n, 3);
      expect(parts.reduce((a, b) => a + b, 0n)).toBe(100_000n);
    });

    it('throws for n <= 0', () => {
      expect(() => splitEqually(U(10), 0)).toThrow();
    });
  });

  describe('end-to-end: expenses -> balances -> transfers', () => {
    it('resolves a shared dinner among three friends in one transfer', () => {
      const expenses = [
        {
          paidById: 'alice',
          amount: U(120),
          splits: [
            { userId: 'alice', amount: U(40) },
            { userId: 'bob', amount: U(40) },
            { userId: 'carol', amount: U(40) },
          ],
        },
        {
          paidById: 'bob',
          amount: U(60),
          splits: [
            { userId: 'alice', amount: U(20) },
            { userId: 'bob', amount: U(20) },
            { userId: 'carol', amount: U(20) },
          ],
        },
      ];
      const transfers = calculateSettlements(computeBalances(expenses));
      // net: alice +60, bob 0, carol -60  =>  a single transfer carol->alice 60
      expect(transfers).toEqual([
        { fromUserId: 'carol', toUserId: 'alice', amount: U(60) },
      ]);
    });
  });
});
