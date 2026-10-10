<template>
  <f7-page ptr @ptr:refresh="refresh">
    <f7-navbar title="Notifications" back-link="Profile">
      <template #right>
        <f7-link v-if="notifications.unreadCount > 0" @click="notifications.markAllRead">
          Mark all read
        </f7-link>
      </template>
    </f7-navbar>

    <f7-list v-if="notifications.items.length > 0" media-list strong inset dividers>
      <f7-list-item
        v-for="item in notifications.items"
        :key="item.id"
        :title="item.title"
        :text="item.body"
        :subtitle="formatRelativeTime(item.createdAt)"
        link
        @click="open(item)"
      >
        <template #media>
          <div
            class="flex h-10 w-10 items-center justify-center rounded-full"
            :style="{ backgroundColor: `${metaFor(item.type).color}22`, color: metaFor(item.type).color }"
          >
            <f7-icon :f7="metaFor(item.type).f7" :material="metaFor(item.type).material" size="20" />
          </div>
        </template>
        <template #after>
          <span v-if="!item.read" class="block h-2.5 w-2.5 rounded-full bg-brand-500" />
        </template>
      </f7-list-item>
    </f7-list>

    <EmptyState
      v-else
      icon="bell_slash"
      material-icon="notifications_off"
      title="No notifications"
      text="Expense, payment and group updates will show up here."
    />
  </f7-page>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { f7 } from 'framework7-vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { formatRelativeTime } from '@/services/utils/format'
import { useNotificationsStore } from '@/stores/notifications'
import type { NotificationItem, NotificationType } from '@/types'

const notifications = useNotificationsStore()

const TYPE_META: Record<NotificationType, { f7: string; material: string; color: string }> = {
  expense_added: { f7: 'cart_fill', material: 'receipt_long', color: '#f59e0b' },
  settlement_reminder: { f7: 'clock_fill', material: 'schedule', color: '#f97316' },
  payment_received: { f7: 'arrow_down_circle_fill', material: 'south', color: '#16a34a' },
  member_joined: { f7: 'person_badge_plus_fill', material: 'person_add', color: '#3b82f6' },
  group_invite: { f7: 'envelope_fill', material: 'mail', color: '#8b5cf6' },
  dispute_opened: { f7: 'exclamationmark_triangle_fill', material: 'warning', color: '#dc2626' },
}

function metaFor(type: NotificationType) {
  return TYPE_META[type] ?? TYPE_META.group_invite
}

async function open(item: NotificationItem) {
  if (!item.read) await notifications.markRead(item.id).catch(() => {})
  if (item.data?.groupId) {
    f7.views.main.router.navigate(`/groups/${item.data.groupId}/`)
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
