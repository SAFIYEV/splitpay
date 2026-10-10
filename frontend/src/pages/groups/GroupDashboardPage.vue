<template>
  <f7-page ptr @ptr:refresh="refresh">
    <f7-navbar :title="group?.name ?? 'Group'" back-link="Groups">
      <template #right>
        <f7-link :href="`/groups/${groupId}/settings/`" icon-f7="gear_alt" icon-material="settings" />
      </template>
    </f7-navbar>

    <template v-if="group">
      <!-- Header card -->
      <f7-card class="sp-stat-card mx-4 mt-4">
        <f7-card-content>
          <div class="flex items-center gap-3">
            <UserAvatar :name="group.name" :size="52" />
            <div class="min-w-0 flex-1">
              <h2 class="m-0 truncate text-lg font-bold">{{ group.name }}</h2>
              <p class="m-0 truncate text-sm opacity-60">
                {{ group.description || `${group.members.length} members` }}
              </p>
            </div>
            <div class="flex -space-x-2">
              <UserAvatar
                v-for="member in group.members.slice(0, 4)"
                :key="member.userId"
                :name="displayName(member.userId)"
                :size="30"
                class="ring-2 ring-white dark:ring-neutral-900"
              />
            </div>
          </div>
        </f7-card-content>
      </f7-card>

      <!-- Stats -->
      <f7-block class="my-4 grid grid-cols-2 gap-3">
        <f7-card class="sp-stat-card m-0">
          <f7-card-content>
            <p class="m-0 text-xs uppercase tracking-wide opacity-60">Total spent</p>
            <p class="mt-1 mb-0 text-xl font-bold">{{ formatUsdc(group.totalSpent) }}</p>
          </f7-card-content>
        </f7-card>
        <f7-card class="sp-stat-card m-0">
          <f7-card-content>
            <p class="m-0 text-xs uppercase tracking-wide opacity-60">Your balance</p>
            <p
              class="mt-1 mb-0 text-xl font-bold"
              :class="myBalance > 0 ? 'sp-positive' : myBalance < 0 ? 'sp-negative' : ''"
            >
              {{ formatUsdc(myBalance) }}
            </p>
          </f7-card-content>
        </f7-card>
      </f7-block>

      <!-- Quick actions -->
      <f7-block class="my-2 grid grid-cols-4 gap-2 text-center">
        <f7-link :href="`/groups/${groupId}/expenses/`" class="flex flex-col items-center gap-1">
          <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 dark:bg-brand-900">
            <f7-icon f7="list_bullet" material="receipt_long" size="22" />
          </span>
          <span class="text-xs">Expenses</span>
        </f7-link>
        <f7-link :href="`/groups/${groupId}/balances/`" class="flex flex-col items-center gap-1">
          <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 dark:bg-brand-900">
            <f7-icon f7="chart_bar_fill" material="balance" size="22" />
          </span>
          <span class="text-xs">Balances</span>
        </f7-link>
        <f7-link :href="`/groups/${groupId}/settle/`" class="flex flex-col items-center gap-1">
          <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 dark:bg-brand-900">
            <f7-icon f7="paperplane_fill" material="send" size="22" />
          </span>
          <span class="text-xs">Settle up</span>
        </f7-link>
        <f7-link :href="`/groups/${groupId}/members/`" class="flex flex-col items-center gap-1">
          <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 dark:bg-brand-900">
            <f7-icon f7="person_2_fill" material="group" size="22" />
          </span>
          <span class="text-xs">Members</span>
        </f7-link>
      </f7-block>

      <!-- Recent expenses -->
      <f7-block-title class="flex items-center justify-between">
        <span>Recent expenses</span>
        <f7-link :href="`/groups/${groupId}/expenses/`" class="text-sm font-medium">See all</f7-link>
      </f7-block-title>
      <f7-list v-if="recentExpenses.length > 0" media-list strong inset>
        <f7-list-item
          v-for="expense in recentExpenses"
          :key="expense.id"
          :link="`/groups/${groupId}/expenses/${expense.id}/`"
          :title="expense.description"
          :subtitle="`${displayName(expense.paidBy)} paid · ${formatDate(expense.date)}`"
          :after="formatUsdc(expense.amount)"
        >
          <template #media>
            <div
              class="flex h-10 w-10 items-center justify-center rounded-full"
              :style="{ backgroundColor: `${categoryMeta(expense.category).color}22`, color: categoryMeta(expense.category).color }"
            >
              <f7-icon
                :f7="categoryMeta(expense.category).f7Icon"
                :material="categoryMeta(expense.category).materialIcon"
                size="20"
              />
            </div>
          </template>
        </f7-list-item>
      </f7-list>
      <EmptyState
        v-else
        icon="receipt"
        material-icon="receipt_long"
        title="No expenses yet"
        text="Add the first shared expense for this group."
      />
    </template>

    <f7-block v-else class="flex justify-center py-16">
      <f7-preloader />
    </f7-block>

    <f7-fab position="right-bottom" :href="`/groups/${groupId}/expenses/new/`">
      <f7-icon f7="plus" material="add" />
    </f7-fab>
  </f7-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import EmptyState from '@/components/common/EmptyState.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { categoryMeta } from '@/composables/categories'
import { formatDate, formatUsdc } from '@/services/utils/format'
import { joinGroupRoom, leaveGroupRoom } from '@/services/websocket'
import { useAuthStore } from '@/stores/auth'
import { useExpensesStore } from '@/stores/expenses'
import { useGroupsStore } from '@/stores/groups'
import { useSettlementsStore } from '@/stores/settlements'
import type { Group } from '@/types'

const props = defineProps<{ f7route: { params: { id: string } } }>()

const groupsStore = useGroupsStore()
const expensesStore = useExpensesStore()
const settlementsStore = useSettlementsStore()
const auth = useAuthStore()

const groupId = props.f7route.params.id
const group = ref<Group | null>(groupsStore.currentGroup?.id === groupId ? groupsStore.currentGroup : null)

const recentExpenses = computed(() =>
  [...expensesStore.expensesFor(groupId)]
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, 5),
)

const myBalance = computed(() => {
  const balance = settlementsStore.balanceByGroup[groupId]
  const me = balance?.balances.find((b) => b.userId === auth.user?.id)
  return me?.amount ?? 0
})

function displayName(userId: string) {
  return groupsStore.memberName(group.value, userId)
}

async function load() {
  const fetched = await groupsStore.fetchGroup(groupId)
  group.value = fetched
  await Promise.allSettled([
    expensesStore.fetchExpenses(groupId),
    settlementsStore.fetchBalance(groupId),
  ])
}

async function refresh(done: () => void) {
  try {
    await load()
  } finally {
    done()
  }
}

onMounted(() => {
  void load().catch(() => {})
  joinGroupRoom(groupId)
})

onBeforeUnmount(() => leaveGroupRoom(groupId))
</script>
