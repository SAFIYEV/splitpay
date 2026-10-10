import type { Expense, ExpenseSplit, MemberBalance, SuggestedDebt } from '@/types'

// Client-side settlement calculator — mirrors the backend greedy algorithm
// (spec section 7.1). Used for instant previews before the server confirms.

const EPSILON = 0.000001 // 1 USDC base unit, in whole-USDC units

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

/**
 * Net balance per member: positive = the member is owed money,
 * negative = the member owes money.
 */
export function calculateBalances(
  expenses: Pick<Expense, 'paidBy' | 'amount' | 'splits'>[],
): MemberBalance[] {
  const totals = new Map<string, number>()

  for (const expense of expenses) {
    totals.set(expense.paidBy, (totals.get(expense.paidBy) ?? 0) + expense.amount)
    for (const split of expense.splits) {
      totals.set(split.userId, (totals.get(split.userId) ?? 0) - split.amount)
    }
  }

  return [...totals.entries()]
    .map(([userId, amount]) => ({ userId, amount: round6(amount) }))
    .sort((a, b) => b.amount - a.amount)
}

/**
 * Minimal set of payments that settles every debt, greedy:
 * always match the biggest debtor with the biggest creditor.
 */
export function calculateSettlements(
  expenses: Pick<Expense, 'paidBy' | 'amount' | 'splits'>[],
): SuggestedDebt[] {
  const debtors = calculateBalances(expenses)
    .filter((b) => b.amount < -EPSILON)
    .sort((a, b) => a.amount - b.amount) // most negative first
  const creditors = calculateBalances(expenses)
    .filter((b) => b.amount > EPSILON)
    .sort((a, b) => b.amount - a.amount) // most positive first

  const debts: SuggestedDebt[] = []

  while (debtors.length > 0 && creditors.length > 0) {
    const debtor = debtors[0]!
    const creditor = creditors[0]!
    const amount = round6(Math.min(Math.abs(debtor.amount), creditor.amount))

    if (amount > EPSILON) {
      debts.push({ fromUserId: debtor.userId, toUserId: creditor.userId, amount })
    }

    debtor.amount = round6(debtor.amount + amount)
    creditor.amount = round6(creditor.amount - amount)

    if (debtor.amount >= -EPSILON) debtors.shift()
    if (creditor.amount <= EPSILON) creditors.shift()
  }

  return debts
}

/** Equal split of `amount` across `userIds`, first members absorb rounding dust. */
export function splitEqually(amount: number, userIds: string[]): ExpenseSplit[] {
  if (userIds.length === 0) return []
  const share = Math.floor((amount * 1_000_000) / userIds.length) / 1_000_000
  const splits = userIds.map((userId) => ({ userId, amount: share }))
  // Distribute the rounding remainder (at most a few base units) to the first member.
  const assigned = share * userIds.length
  const remainder = round6(amount - assigned)
  if (Math.abs(remainder) > EPSILON) {
    splits[0]!.amount = round6(splits[0]!.amount + remainder)
  }
  return splits
}

/** Percentage split; percentages must sum to 100. */
export function splitByPercentage(
  amount: number,
  entries: { userId: string; percentage: number }[],
): ExpenseSplit[] {
  const totalPct = entries.reduce((sum, e) => sum + e.percentage, 0)
  if (Math.abs(totalPct - 100) > 0.01) {
    throw new Error('Percentages must add up to 100')
  }
  const splits = entries.map((e) => ({
    userId: e.userId,
    amount: round6((amount * e.percentage) / 100),
    percentage: e.percentage,
  }))
  const assigned = splits.reduce((sum, s) => sum + s.amount, 0)
  const remainder = round6(amount - assigned)
  if (Math.abs(remainder) > EPSILON && splits.length > 0) {
    splits[0]!.amount = round6(splits[0]!.amount + remainder)
  }
  return splits
}
