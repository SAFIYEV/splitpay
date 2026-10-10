<template>
  <f7-page ptr @ptr:refresh="refresh">
    <f7-navbar title="Balances" back-link="Back" />

    <f7-block-title>Net balances</f7-block-title>
    <f7-list v-if="balances.length > 0" strong inset dividers>
      <f7-list-item v-for="entry in balances" :key="entry.userId" :title="displayName(entry.userId)">
        <template #media>
          <UserAvatar :name="displayName(entry.userId)" :size="36" />
        </template>
        <template #after>
          <span
            class="font-semibold"
            :class="entry.amount > 0 ? 'sp-positive' : entry.amount < 0 ? 'sp-negative' : 'opacity-50'"
          >
            {{ entry.amount > 0 ? '+' : '' }}{{ formatUsdc(entry.amount) }}
          </span>
        </template>
        <template #subtitle>
          {{ entry.amount > 0 ? 'is owed' : entry.amount < 0 ? 'owes' : 'settled up' }}
        </template>
      </f7-list-item>
    </f7-list>

    <f7-block-title>How to settle up</f7-block-title>
    <f7-list v-if="debts.length > 0" strong inset dividers>
      <DebtListItem v-for="(debt, i) in debts" :key="i" :debt="debt" :member-name="displayName">
        <template #action>
          <f7-button
            v-if="debt.fromUserId === auth.user?.id"
            small
            fill
            round
            class="ml-2"
            :href="`/groups/${groupId}/settle/?to=${debt.toUserId}&amount=${debt.amount}`"
          >
            Pay
          </f7-button>
        </template>
      </DebtListItem>
    </f7-list>
    <EmptyState
      v-else
      icon="checkmark_seal_fill"
      material-icon="verified"
      title="All settled up"
      text="Nobody owes anything in this group."
    />

    <f7-block v-if="fromLocalCalc" class="my-2 text-xs opacity-50">
      Server unavailable — showing balances computed locally from cached expenses.
    </f7-block>

    <f7-block-title v-if="history.length > 0">Settlement history</f7-block-title>
    <f7-list v-if="history.length > 0" strong inset dividers>
      <f7-list-item
        v-for="s in history"
        :key="s.id"
        :title="`${displayName(s.fromUser)} → ${displayName(s.toUser)}`"
        :after="formatUsdc(s.amount)"
        :subtitle="formatRelativeTime(s.createdAt ?? '')"
      >
        <template #media>
          <f7-icon
            :f7="statusIcon(s.status)"
            :material="statusMaterial(s.status)"
            :color="statusColor(s.status)"
            size="24"
          />
        </template>
        <template #footer>
          <f7-badge :color="statusColor(s.status)">{{ s.status }}</f7-badge>
        </template>
      </f7-list-item>
    </f7-list>
  </f7-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import EmptyState from '@/components/common/EmptyState.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import DebtListItem from '@/components/settlement/DebtListItem.vue'
import { formatRelativeTime, formatUsdc } from '@/services/utils/format'
import { calculateBalances, calculateSettlements } from '@/services/utils/split-calculator'
import { useAuthStore } from '@/stores/auth'
import { useExpensesStore } from '@/stores/expenses'
import { useGroupsStore } from '@/stores/groups'
import { useSettlementsStore } from '@/stores/settlements'
import type { MemberBalance, SettlementStatus, SuggestedDebt } from '@/types'

const props = defineProps<{ f7route: { params: { id: string } } }>()

const auth = useAuthStore()
const groupsStore = useGroupsStore()
const expensesStore = useExpensesStore()
const settlementsStore = useSettlementsStore()

const groupId = props.f7route.params.id
const fromLocalCalc = ref(false)

const group = computed(() =>
  groupsStore.currentGroup?.id === groupId ? groupsStore.currentGroup : null,
)

/** Server-provided debt graph; falls back to the local greedy calculator when offline. */
const serverBalance = computed(() => settlementsStore.balanceByGroup[groupId] ?? null)

const balances = computed<MemberBalance[]>(() => {
  if (serverBalance.value) return serverBalance.value.balances
  return calculateBalances(expensesStore.expensesFor(groupId))
})

const debts = computed<SuggestedDebt[]>(() => {
  if (serverBalance.value) return serverBalance.value.debts
  return calculateSettlements(expensesStore.expensesFor(groupId))
})

const history = computed(() => settlementsStore.historyByGroup[groupId] ?? [])

function displayName(userId: string) {
  return groupsStore.memberName(group.value, userId)
}

function statusIcon(status: SettlementStatus): string {
  const map: Record<SettlementStatus, string> = {
    pending: 'clock_fill',
    processing: 'arrow_2_circlepath',
    completed: 'checkmark_circle_fill',
    failed: 'xmark_circle_fill',
    disputed: 'exclamationmark_triangle_fill',
  }
  return map[status]
}
function statusMaterial(status: SettlementStatus): string {
  const map: Record<SettlementStatus, string> = {
    pending: 'schedule',
    processing: 'sync',
    completed: 'check_circle',
    failed: 'cancel',
    disputed: 'warning',
  }
  return map[status]
}
function statusColor(status: SettlementStatus): string {
  const map: Record<SettlementStatus, string> = {
    pending: 'orange',
    processing: 'blue',
    completed: 'green',
    failed: 'red',
    disputed: 'yellow',
  }
  return map[status]
}

async function refresh(done: () => void) {
  try {
    await load()
  } finally {
    done()
  }
}

async function load() {
  try {
    await settlementsStore.fetchBalance(groupId)
    fromLocalCalc.value = false
  } catch {
    // Offline fallback: local greedy calculation from cached expenses.
    if (expensesStore.expensesFor(groupId).length === 0) {
      await expensesStore.fetchExpenses(groupId).catch(() => {})
    }
    fromLocalCalc.value = true
  }
  await settlementsStore.fetchHistory(groupId).catch(() => {})
}

onMounted(() => {
  if (!group.value) void groupsStore.fetchGroup(groupId).catch(() => {})
  void load()
})
</script>
