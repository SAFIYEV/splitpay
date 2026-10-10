import { io, type Socket } from 'socket.io-client'
import { useExpensesStore } from '@/stores/expenses'
import { useGroupsStore } from '@/stores/groups'
import { useNotificationsStore } from '@/stores/notifications'
import { useSettlementsStore } from '@/stores/settlements'
import type { Expense, NotificationItem, Settlement } from '@/types'

// Socket.io realtime client (spec 4.2). Connects with the JWT, joins
// `join:group:{id}` rooms and dispatches server events into Pinia stores.

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3000'

let socket: Socket | null = null
const joinedGroups = new Set<string>()

export function connectWebSocket(token: string): Socket {
  if (socket?.connected) return socket
  disconnectWebSocket()

  socket = io(WS_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  })

  socket.onAny(dispatchEvent)
  socket.on('connect', () => {
    // Re-join all rooms after a reconnect.
    for (const groupId of joinedGroups) {
      socket?.emit(`join:group:${groupId}`)
    }
  })

  return socket
}

export function disconnectWebSocket() {
  socket?.disconnect()
  socket = null
  joinedGroups.clear()
}

export function isWebSocketConnected(): boolean {
  return socket?.connected ?? false
}

export function joinGroupRoom(groupId: string) {
  joinedGroups.add(groupId)
  socket?.emit(`join:group:${groupId}`)
}

export function leaveGroupRoom(groupId: string) {
  joinedGroups.delete(groupId)
  socket?.emit(`leave:group:${groupId}`)
}

/** Payloads arrive either as the bare entity or wrapped, e.g. { expense: {...} }. */
function unwrap<T>(payload: unknown, key: string): T | null {
  if (!payload || typeof payload !== 'object') return null
  const record = payload as Record<string, unknown>
  return (record[key] ?? payload) as T
}

function dispatchEvent(event: string, payload: unknown) {
  // Events look like `group:{groupId}:expense:new`.
  const match = /^group:([^:]+):(\w+):(\w+)$/.exec(event)
  if (!match) return
  const groupId = match[1]!
  const domain = match[2]!
  const action = match[3]!

  const expenses = useExpensesStore()
  const settlements = useSettlementsStore()
  const groups = useGroupsStore()
  const notifications = useNotificationsStore()

  switch (`${domain}:${action}`) {
    case 'expense:new':
    case 'expense:updated': {
      const expense = unwrap<Expense>(payload, 'expense')
      if (expense?.id) expenses.upsertExpense(groupId, expense)
      break
    }
    case 'expense:deleted': {
      const id =
        unwrap<Expense>(payload, 'expense')?.id ??
        (payload as { expenseId?: string } | null)?.expenseId
      if (id) expenses.removeExpense(groupId, id)
      break
    }
    case 'settlement:new':
    case 'settlement:paid': {
      const settlement = unwrap<Settlement>(payload, 'settlement')
      if (settlement?.id) settlements.upsertHistory(groupId, settlement)
      // Balances changed — refetch so the debt graph stays accurate.
      void settlements.fetchBalance(groupId)
      break
    }
    case 'member:joined':
    case 'member:left':
      void groups.fetchGroup(groupId)
      break
  }

  // Surface a notification if the payload carries one.
  const notification = unwrap<NotificationItem | null>(payload, 'notification')
  if (notification?.id && notification.title) {
    notifications.pushIncoming(notification)
  }
}
