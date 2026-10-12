import type {
  Expense,
  ExpenseCategory,
  Group,
  GroupBalance,
  NotificationItem,
  Settlement,
  User,
} from '@/types'

// Maps raw backend payloads into the UI-facing types:
// - Prisma Decimals arrive as strings ("800.000000") → numbers
// - Expense relations arrive as paidById + paidBy user object → flat id + user
// - Group inviteCode/splitMethod live top-level on the backend model

type Raw = Record<string, unknown>

function num(value: unknown): number {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value)
  return Number.isFinite(n) ? n : 0
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export function normalizeUser(raw: unknown): User | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Raw
  if (!r.id) return undefined
  return {
    id: String(r.id),
    email: str(r.email),
    displayName: str(r.displayName) ?? 'Пользователь',
    avatar: str(r.avatar),
    walletAddress: str(r.walletAddress),
    verified: Boolean(r.verified),
    createdAt: str(r.createdAt),
  }
}

export function normalizeGroup(raw: unknown): Group {
  const r = raw as Raw
  const metadata = (r.metadata ?? {}) as Raw
  return {
    id: String(r.id),
    name: str(r.name) ?? 'Группа',
    description: str(r.description),
    photo: str(r.photo),
    currency: str(r.currency) ?? 'USDC',
    inviteCode: str(r.inviteCode) ?? str(metadata.inviteCode),
    splitMethod: (str(r.splitMethod) ?? str(metadata.splitMethod)) as Group['splitMethod'],
    members: Array.isArray(r.members)
      ? (r.members as Raw[]).map((m) => ({
          userId: String(m.userId),
          user: normalizeUser(m.user),
          role: (str(m.role) ?? 'member') as 'admin' | 'member',
          nickname: str(m.nickname),
          joinedAt: str(m.joinedAt),
        }))
      : [],
    totalSpent: num(r.totalSpent),
    status: (str(r.status) ?? 'active') as Group['status'],
    solanaGroupPDA: str(r.solanaGroupPDA),
    createdAt: str(r.createdAt),
    updatedAt: str(r.updatedAt),
  }
}

export function normalizeExpense(raw: unknown): Expense {
  const r = raw as Raw
  const paidByObject = normalizeUser(r.paidBy)
  return {
    id: String(r.id),
    groupId: String(r.groupId),
    paidBy: str(r.paidById) ?? (paidByObject ? paidByObject.id : String(r.paidBy ?? '')),
    paidByUser: paidByObject,
    amount: num(r.amount),
    description: str(r.description) ?? '',
    category: (str(r.category) ?? 'other') as ExpenseCategory,
    date: str(r.date) ?? new Date().toISOString(),
    splits: Array.isArray(r.splits)
      ? (r.splits as Raw[]).map((s) => ({
          userId: String(s.userId),
          user: normalizeUser(s.user),
          amount: num(s.amount),
          percentage: s.percentage != null ? num(s.percentage) : undefined,
        }))
      : [],
    receipt: str(r.receipt),
    solanaExpensePDA: str(r.solanaExpensePDA),
    createdAt: str(r.createdAt),
    updatedAt: str(r.updatedAt),
  }
}

export function normalizeSettlement(raw: unknown): Settlement {
  const r = raw as Raw
  return {
    id: String(r.id),
    groupId: String(r.groupId),
    fromUser: str(r.fromUserId) ?? String(r.fromUser ?? ''),
    fromUserData: normalizeUser(r.fromUser),
    toUser: str(r.toUserId) ?? String(r.toUser ?? ''),
    toUserData: normalizeUser(r.toUser),
    amount: num(r.amount),
    status: (str(r.status) ?? 'pending') as Settlement['status'],
    solanaTransactionId: str(r.solanaTransactionId),
    solanaSettlementPDA: str(r.solanaSettlementPDA),
    notes: str(r.notes),
    expiresAt: str(r.expiresAt),
    completedAt: str(r.completedAt),
    createdAt: str(r.createdAt),
    updatedAt: str(r.updatedAt),
  }
}

export function normalizeBalance(raw: unknown): GroupBalance {
  const r = (raw ?? {}) as Raw
  const debtsRaw = Array.isArray(r.debts) ? r.debts : Array.isArray(r.settlements) ? r.settlements : []
  return {
    balances: Array.isArray(r.balances)
      ? (r.balances as Raw[]).map((b) => ({
          userId: String(b.userId),
          user: normalizeUser(b.user),
          amount: num(b.amount),
        }))
      : [],
    debts: (debtsRaw as Raw[]).map((d) => ({
      fromUserId: String(d.fromUserId),
      toUserId: String(d.toUserId),
      amount: num(d.amount),
    })),
  }
}

export function normalizeNotification(raw: unknown): NotificationItem {
  const r = raw as Raw
  return {
    id: String(r.id),
    type: (str(r.type) ?? 'group_invite') as NotificationItem['type'],
    title: str(r.title) ?? '',
    body: str(r.body) ?? '',
    data: r.data as NotificationItem['data'],
    read: Boolean(r.read),
    createdAt: str(r.createdAt) ?? new Date().toISOString(),
  }
}

export function normalizeArray<T>(raw: unknown, fn: (item: unknown) => T): T[] {
  return Array.isArray(raw) ? raw.map(fn) : []
}
