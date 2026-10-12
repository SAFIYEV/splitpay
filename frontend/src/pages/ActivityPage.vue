<template>
  <f7-page ptr @ptr:refresh="refresh">
    <f7-page-content class="pb-32">
      <div class="px-6 pt-8 pb-4">
        <h1 class="m-0 text-2xl font-bold">Активность</h1>
      </div>

      <!-- Filter chips -->
      <div class="mb-5 flex gap-2 overflow-x-auto px-6" style="scrollbar-width: none">
        <button
          v-for="chip in chips"
          :key="chip.id"
          type="button"
          class="shrink-0 rounded-full border-0 px-4 py-2 text-sm font-semibold"
          :style="filter === chip.id
            ? 'background: var(--color-accent); color: #fff'
            : 'background: #fff; color: var(--color-sub)'"
          @click="filter = chip.id"
        >
          {{ chip.label }}
        </button>
      </div>

      <template v-if="grouped.length > 0">
        <div v-for="[day, items] in grouped" :key="day" class="mb-5 px-6">
          <p class="m-0 mb-2.5 text-[13px] font-semibold" style="color: var(--color-sub)">{{ day }}</p>
          <div v-for="item in items" :key="item.id" class="sp-card-sm mb-2.5 flex items-center gap-3 p-4">
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              :style="{ backgroundColor: `${metaFor(item.type).color}1a`, color: metaFor(item.type).color }"
            >
              <f7-icon :f7="metaFor(item.type).f7" size="18" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="m-0 truncate text-sm font-semibold">{{ item.title }}</p>
              <p class="m-0 truncate text-xs" style="color: var(--color-sub)">{{ item.body }}</p>
              <p class="m-0 text-xs" style="color: var(--color-sub)">{{ formatDateTimeRu(item.createdAt) }}</p>
            </div>
            <span v-if="!item.read" class="h-2 w-2 shrink-0 rounded-full" style="background: var(--color-accent)" />
          </div>
        </div>
      </template>

      <div v-else class="sp-card mx-6 p-8 text-center">
        <p class="m-0 mb-1 font-semibold">Пока пусто</p>
        <p class="m-0 text-sm" style="color: var(--color-sub)">
          Новые расходы, платежи и участники появятся здесь.
        </p>
      </div>
    </f7-page-content>

    <TabBar active="activity" />
  </f7-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import TabBar from '@/components/layout/TabBar.vue'
import { formatDateRu, formatDateTimeRu } from '@/services/utils/format'
import { useNotificationsStore } from '@/stores/notifications'
import type { NotificationItem, NotificationType } from '@/types'

const notifications = useNotificationsStore()

type Filter = 'all' | 'expenses' | 'payments' | 'income'
const filter = ref<Filter>('all')
const chips: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'expenses', label: 'Расходы' },
  { id: 'payments', label: 'Платежи' },
  { id: 'income', label: 'Доходы' },
]

const FILTER_TYPES: Record<Filter, NotificationType[] | null> = {
  all: null,
  expenses: ['expense_added'],
  payments: ['settlement_reminder', 'dispute_opened'],
  income: ['payment_received'],
}

const filtered = computed(() => {
  const types = FILTER_TYPES[filter.value]
  const list = [...notifications.items].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
  return types ? list.filter((n) => types.includes(n.type)) : list
})

/** Day-grouped: Сегодня / Вчера / date. */
const grouped = computed<[string, NotificationItem[]][]>(() => {
  const groups = new Map<string, NotificationItem[]>()
  for (const item of filtered.value) {
    const day = dayLabel(item.createdAt)
    const list = groups.get(day) ?? []
    list.push(item)
    groups.set(day, list)
  }
  return [...groups.entries()]
})

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

function dayLabel(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Сегодня'
  if (date.toDateString() === yesterday.toDateString()) return 'Вчера'
  return formatDateRu(date)
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
