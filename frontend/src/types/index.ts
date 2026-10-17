// Shared domain types. These describe the NORMALIZED shapes used across the UI —
// services/normalize.ts maps raw backend payloads (Prisma Decimals as strings,
// paidById/user-object relations, top-level inviteCode) into these.

export interface User {
  id: string
  email?: string
  displayName: string
  avatar?: string
  walletAddress?: string
  verified?: boolean
  createdAt?: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthResponse {
  user: User
  accessToken: string
  refreshToken: string
}

export type GroupRole = 'admin' | 'member'
export type SplitMethod = 'equal' | 'percentage' | 'custom'

export interface GroupMember {
  userId: string
  user?: User
  role: GroupRole
  nickname?: string
  joinedAt?: string
}

export interface Group {
  id: string
  name: string
  description?: string
  photo?: string
  currency: string
  inviteCode?: string
  splitMethod?: SplitMethod
  members: GroupMember[]
  /** Total spent across all expenses, in USDC. */
  totalSpent: number
  status: 'active' | 'archived'
  solanaGroupPDA?: string
  createdAt?: string
  updatedAt?: string
}

export type ExpenseCategory =
  | 'food'
  | 'transport'
  | 'accommodation'
  | 'entertainment'
  | 'other'

export interface ExpenseSplit {
  userId: string
  user?: User
  amount: number
  percentage?: number
}

export interface Expense {
  id: string
  groupId: string
  /** User id of the payer. */
  paidBy: string
  paidByUser?: User
  amount: number
  description: string
  category: ExpenseCategory
  date: string
  splits: ExpenseSplit[]
  receipt?: string
  solanaExpensePDA?: string
  createdAt?: string
  updatedAt?: string
}

export interface ExpenseDraft {
  amount: number
  description: string
  category: ExpenseCategory
  date?: string
  splits: { userId: string; amount: number; percentage?: number }[]
}

export type SettlementStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'disputed'

export interface Settlement {
  id: string
  groupId: string
  /** User id of the payer. */
  fromUser: string
  fromUserData?: User
  /** User id of the recipient. */
  toUser: string
  toUserData?: User
  amount: number
  status: SettlementStatus
  /** Who recorded the settlement; off-chain completion needs the counterparty. */
  createdBy?: string
  solanaTransactionId?: string
  solanaSettlementPDA?: string
  notes?: string
  expiresAt?: string
  completedAt?: string
  createdAt?: string
  updatedAt?: string
}

/** Net balance of one member: positive = is owed, negative = owes. */
export interface MemberBalance {
  userId: string
  user?: User
  amount: number
}

/** One minimal payment that settles part of the group debt graph. */
export interface SuggestedDebt {
  fromUserId: string
  fromUser?: User
  toUserId: string
  toUser?: User
  amount: number
}

export interface GroupBalance {
  balances: MemberBalance[]
  debts: SuggestedDebt[]
}

export type NotificationType =
  | 'expense_added'
  | 'settlement_reminder'
  | 'payment_received'
  | 'member_joined'
  | 'group_invite'
  | 'dispute_opened'

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  body: string
  data?: {
    groupId?: string
    expenseId?: string
    settlementId?: string
  }
  read: boolean
  createdAt: string
}
