import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/services/api'
import { normalizeArray, normalizeNotification } from '@/services/normalize'
import type { NotificationItem } from '@/types'

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<NotificationItem[]>([])
  const loading = ref(false)

  const unreadCount = computed(() => items.value.filter((n) => !n.read).length)

  async function fetchNotifications() {
    loading.value = true
    try {
      const { data } = await api.get<unknown>('/notifications')
      items.value = normalizeArray(data, normalizeNotification)
    } finally {
      loading.value = false
    }
  }

  async function markRead(id: string) {
    await api.patch(`/notifications/${id}/read`)
    const item = items.value.find((n) => n.id === id)
    if (item) item.read = true
  }

  async function markAllRead() {
    const unread = items.value.filter((n) => !n.read)
    await Promise.allSettled(unread.map((n) => api.patch(`/notifications/${n.id}/read`)))
    unread.forEach((n) => {
      n.read = true
    })
  }

  /** Insert a realtime notification pushed over the WebSocket. */
  function pushIncoming(notification: NotificationItem) {
    if (!items.value.some((n) => n.id === notification.id)) {
      items.value.unshift(notification)
    }
  }

  return {
    items,
    loading,
    unreadCount,
    fetchNotifications,
    markRead,
    markAllRead,
    pushIncoming,
  }
})
