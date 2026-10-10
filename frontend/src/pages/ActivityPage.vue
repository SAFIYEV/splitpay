<template>
  <f7-page ptr @ptr:refresh="refresh">
    <f7-navbar title="Activity" back-link="Groups" />

    <f7-timeline v-if="feed.length > 0" class="mx-4 my-4">
      <f7-timeline-item
        v-for="item in feed"
        :key="item.id"
        :day="dayLabel(item.createdAt)"
        :time="timeLabel(item.createdAt)"
      >
        <div class="flex items-start gap-2">
          <f7-icon
            :f7="metaFor(item.type).f7"
            :material="metaFor(item.type).material"
            size="18"
            :style="{ color: metaFor(item.type).color }"
            class="mt-0.5"
          />
          <div>
            <p class="m-0 text-sm font-semibold">{{ item.title }}</p>
            <p class="m-0 text-sm opacity-70">{{ item.body }}</p>
          </div>
        </div>
      </f7-timeline-item>
    </f7-timeline>

    <EmptyState
      v-else
      icon="bolt"
      material-icon="bolt"
      title="Nothing yet"
      text="Activity across all your groups — new expenses, payments and members — will appear here."
    />
  </f7-page>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useNotificationsStore } from '@/stores/notifications'
import type { NotificationType } from '@/types'

const notifications = useNotificationsStore()

/** Activity feed = cross-group notification stream, newest first. */
const feed = computed(() =>
  [...notifications.items].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
)

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

function dayLabel(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
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
