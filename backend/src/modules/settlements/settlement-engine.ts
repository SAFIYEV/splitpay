/**
 * Settlement engine (spec 7.1) — pure functions.
 *
 * All amounts are integers in micro-units (1 USDC = 1_000_000 micro-units)
 * so the algorithm never touches floating point.
 *
 * Balance sign convention: positive = the user is owed money (creditor),
 * negative = the user owes money (debtor).
 */

export interface SettlementTransfer {
  fromUserId: string;
  toUserId: string;
  /** amount in micro-units */
  amount: bigint;
}

/**
 * Builds the balance map from expenses (and, optionally, already completed
 * settlements which offset balances).
 */
export function computeBalances(
  expenses: {
    paidById: string;
    amount: bigint;
    splits: { userId: string; amount: bigint }[];
  }[],
  completedSettlements: {
    fromUserId: string;
    toUserId: string;
    amount: bigint;
  }[] = [],
): Map<string, bigint> {
  const balances = new Map<string, bigint>();
  const add = (userId: string, delta: bigint) =>
    balances.set(userId, (balances.get(userId) ?? 0n) + delta);

  for (const expense of expenses) {
    add(expense.paidById, expense.amount);
    for (const split of expense.splits) {
      add(split.userId, -split.amount);
    }
  }
  // A completed settlement moves money from -> to, so it cancels that debt.
  for (const s of completedSettlements) {
    add(s.fromUserId, s.amount);
    add(s.toUserId, -s.amount);
  }
  return balances;
}

/**
 * Greedy minimisation: repeatedly match the largest debtor with the largest
 * creditor. Deterministic — ties are broken by userId.
 */
export function calculateSettlements(
  balances: Map<string, bigint>,
): SettlementTransfer[] {
  const debtors = [...balances.entries()]
    .filter(([, v]) => v < 0n)
    .sort(([aId, a], [bId, b]) => (a === b ? aId.localeCompare(bId) : a < b ? -1 : 1));
  const creditors = [...balances.entries()]
    .filter(([, v]) => v > 0n)
    .sort(([aId, a], [bId, b]) => (a === b ? aId.localeCompare(bId) : a > b ? -1 : 1));

  const transfers: SettlementTransfer[] = [];
  while (debtors.length > 0 && creditors.length > 0) {
    const [debtorId, debtAmount] = debtors[0];
    const [creditorId, creditAmount] = creditors[0];

    const amount = -debtAmount < creditAmount ? -debtAmount : creditAmount;
    transfers.push({ fromUserId: debtorId, toUserId: creditorId, amount });

    debtors[0][1] += amount;
    creditors[0][1] -= amount;
    if (debtors[0][1] === 0n) debtors.shift();
    if (creditors[0][1] === 0n) creditors.shift();
  }
  return transfers;
}

/**
 * Splits a total into n equal shares; the micro-unit remainder is
 * distributed one unit at a time to the first shares, so the parts always
 * sum exactly to the total.
 */
export function splitEqually(total: bigint, n: number): bigint[] {
  if (n <= 0) {
    throw new Error('splitEqually requires n > 0');
  }
  const share = total / BigInt(n);
  const remainder = total % BigInt(n);
  return Array.from({ length: n }, (_, i) =>
    share + (BigInt(i) < remainder ? 1n : 0n),
  );
}
