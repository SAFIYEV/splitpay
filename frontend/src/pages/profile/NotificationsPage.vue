<template>
  <f7-page ptr @ptr:refresh="refresh">
    <f7-page-content class="pb-10">
      <div class="flex items-center justify-between px-5 pt-6 pb-2">
        <button type="button" class="sp-icon-btn" @click="go('/profile/')">
          <f7-icon f7="chevron_left" size="20" />
        </button>
        <h1 class="m-0 text-lg font-bold">Уведомления</h1>
        <button
          v-if="notifications.unreadCount > 0"
          type="button"
          class="border-0 bg-transparent text-sm font-semibold"
          style="color: var(--color-accent)"
          @click="notifications.markAllRead"
        >
          Прочитать все
        </button>
        <div v-else class="w-10" />
      </div>

      <div class="mt-3 px-6">
        <template v-if="notifications.items.length > 0">
          <button
            v-for="item in notifications.items"
            :key="item.id"
            type="button"
            class="sp-card-sm mb-2.5 flex w-full items-center gap-3 border-0 p-4 text-left"
            @click="open(item)"
          >
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              :style="{ backgroundColor: `${metaFor(item.type).color}1a`, color: metaFor(item.type).color }"
            >
              <f7-icon :f7="metaFor(item.type).f7" size="18" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold">{{ item.title }}</span>
              <span class="block truncate text-xs" style="color: var(--color-sub)">{{ item.body }}</span>
              <span class="block text-xs" style="color: var(--color-sub)">{{ formatDateTimeRu(item.createdAt) }}</span>
            </span>
            <span v-if="!item.read" class="h-2 w-2 shrink-0 rounded-full" style="background: var(--color-accent)" />
          </button>
        </template>

        <div v-else class="sp-card p-8 text-center">
          <p class="m-0 mb-1 font-semibold">Нет уведомлений</p>
          <p class="m-0 text-sm" style="color: var(--color-sub)">
            Расходы, платежи и приглашения появятся здесь.
          </p>
        </div>
      </div>
    </f7-page-content>
  </f7-page>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { f7 } from 'framework7-vue'
import { formatDateTimeRu } from '@/services/utils/format'
import { useNotificationsStore } from '@/stores/notifications'
import type { NotificationItem, NotificationType } from '@/types'

const notifications = useNotificationsStore()

const TYPE_META: Record<NotificationType, { f7: string; color: string }> = {
  expense_added: { f7: 'cart_fill', color: '#f59e0b' },
  settlement_reminder: { f7: 'clock_fill', color: '#6d5be2' },
  payment_received: { f7: 'arrow_down_circle_fill', color: '#34c77b' },
  member_joined: { f7: 'person_badge_plus_fill', color: '#3b82f6' },
  group_invite: { f7: 'envelope_fill', color: '#8b5cf6' },
  dispute_opened: { f7: 'exclamationmark_triangle_fill', color: '#f2507b' },
}

function metaFor(type: NotificationType) {
  return TYPE_META[type] ?? TYPE_META.group_invite
}

function go(url: string) {
  f7.views.main.router.navigate(url)
}

async function open(item: NotificationItem) {
  if (!item.read) await notifications.markRead(item.id).catch(() => {})
  if (item.data?.groupId) {
    go(`/groups/${item.data.groupId}/`)
  }
}

async function refresh(done: () => void) {
  try {
    await notifications.fetchNotifications()
  } finally {
    done()
  }
}

onMounted(() => {
  void notifications.fetchNotifications().catch(() => {})
})
</script>
