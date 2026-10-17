<template>
  <f7-page ptr @ptr:refresh="refresh">
    <f7-page-content class="pb-28">
      <!-- Header -->
      <div class="flex items-center justify-between px-5 pt-6 pb-2">
        <button type="button" class="sp-icon-btn" @click="go(`/groups/${groupId}/`)">
          <f7-icon f7="chevron_left" size="20" />
        </button>
        <h1 class="m-0 text-lg font-bold">Расчёты</h1>
        <div class="w-10" />
      </div>

      <!-- Tabs -->
      <div class="px-6">
        <div class="mt-2 flex rounded-full p-1" style="background: #eceaf7">
          <button
            type="button"
            class="sp-seg-btn flex-1 rounded-full py-2.5 text-sm font-semibold"
            :style="tab === 'owed' ? 'background: #fff; color: var(--color-accent); box-shadow: 0 4px 12px rgba(109,91,226,0.12)' : 'color: var(--color-sub)'"
            @click="tab = 'owed'"
          >
            Кто должен мне
          </button>
          <button
            type="button"
            class="sp-seg-btn flex-1 rounded-full py-2.5 text-sm font-semibold"
            :style="tab === 'owe' ? 'background: #fff; color: var(--color-accent); box-shadow: 0 4px 12px rgba(109,91,226,0.12)' : 'color: var(--color-sub)'"
            @click="tab = 'owe'"
          >
            Кому я должен
          </button>
        </div>
      </div>

      <!-- Кто должен мне -->
      <div v-if="tab === 'owed'" class="mt-5 px-6">
        <p class="m-0 text-[13px] font-medium" style="color: var(--color-sub)">Вам должны</p>
        <p class="sp-positive m-0 mt-1 mb-4 text-[28px] leading-8 font-bold">{{ formatUsdc(totalOwedToMe) }}</p>

        <template v-if="owedToMe.length > 0">
          <div v-for="debt in owedToMe" :key="debt.fromUserId" class="sp-card-sm mb-3 flex items-center gap-3 p-4">
            <UserAvatar :name="displayName(debt.fromUserId)" :size="42" />
            <div class="min-w-0 flex-1">
              <p class="m-0 truncate font-semibold">{{ displayName(debt.fromUserId) }}</p>
              <p class="m-0 text-sm" style="color: var(--color-sub)">{{ formatUsdc(debt.amount) }}</p>
            </div>
            <button
              type="button"
              class="rounded-full border-0 px-4 py-2 text-sm font-semibold"
              style="background: var(--color-accent-soft); color: var(--color-accent)"
              @click="requestPayment(debt)"
            >
              Запросить
            </button>
          </div>
        </template>
        <div v-else class="sp-card p-6 text-center text-sm" style="color: var(--color-sub)">
          Никто вам не должен
        </div>
      </div>

      <!-- Кому я должен -->
      <div v-else class="mt-5 px-6">
        <p class="m-0 text-[13px] font-medium" style="color: var(--color-sub)">Вы должны</p>
        <p class="sp-negative m-0 mt-1 mb-4 text-[28px] leading-8 font-bold">{{ formatUsdc(totalIOwe) }}</p>

        <template v-if="iOwe.length > 0">
          <div v-for="debt in iOwe" :key="debt.toUserId" class="sp-card-sm mb-3 flex items-center gap-3 p-4">
            <UserAvatar :name="displayName(debt.toUserId)" :size="42" />
            <div class="min-w-0 flex-1">
              <p class="m-0 truncate font-semibold">{{ displayName(debt.toUserId) }}</p>
              <p class="m-0 text-sm" style="color: var(--color-sub)">{{ formatUsdc(debt.amount) }}</p>
            </div>
            <button
              type="button"
              class="rounded-full border-0 px-4 py-2 text-sm font-semibold text-white"
              style="background: linear-gradient(135deg, #7c6cf0, #9d7bfa)"
              @click="go(`/groups/${groupId}/settle/?to=${debt.toUserId}&amount=${debt.amount}`)"
            >
              Оплатить
            </button>
          </div>
        </template>
        <div v-else class="sp-card p-6 text-center text-sm" style="color: var(--color-sub)">
          Вы никому не должны
        </div>
      </div>

      <p class="mt-6 text-center text-xs" style="color: var(--color-sub)">Все расчёты в USDC на Solana</p>

      <!-- History -->
      <div v-if="history.length > 0" class="mt-6 px-6">
        <h3 class="m-0 mb-3 text-[17px] font-bold">История</h3>
        <div v-for="s in history" :key="s.id" class="sp-card-sm mb-3 flex items-center gap-3 p-4">
          <span
            class="flex h-10 w-10 items-center justify-center rounded-full"
            :style="{ backgroundColor: `${statusColorHex(s.status)}1a`, color: statusColorHex(s.status) }"
          >
            <f7-icon :f7="statusIcon(s.status)" size="18" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="m-0 truncate text-sm font-semibold">
              {{ displayName(s.fromUser) }} → {{ displayName(s.toUser) }}
            </p>
            <p class="m-0 text-xs" style="color: var(--color-sub)">{{ statusLabel(s.status) }}</p>
          </div>
          <span class="text-sm font-bold">{{ formatUsdc(s.amount) }}</span>
          <button
            v-if="canConfirm(s)"
            type="button"
            class="rounded-full border-0 px-3 py-1.5 text-xs font-semibold"
            style="background: var(--color-accent-soft); color: var(--color-accent)"
            @click="confirmReceipt(s)"
          >
            Подтвердить
          </button>
        </div>
      </div>
    </f7-page-content>

    <!-- Bottom segmented: Обзор / Расчёты -->
    <div class="absolute right-0 bottom-0 left-0 z-30 px-16 pb-6">
      <div class="flex rounded-full p-1" style="background: #eceaf7">
        <button type="button" class="sp-seg-btn flex-1 rounded-full py-2.5 text-sm font-semibold" style="color: var(--color-sub)" @click="go(`/groups/${groupId}/`)">
          Обзор
        </button>
        <button type="button" class="flex-1 rounded-full bg-white py-2.5 text-sm font-semibold" style="color: var(--color-accent); box-shadow: 0 4px 12px rgba(109,91,226,0.12)">
          Расчёты
        </button>
      </div>
    </div>
  </f7-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { f7 } from 'framework7-vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { apiErrorMessage } from '@/services/api'
import { formatUsdc } from '@/services/utils/format'
import { calculateSettlements } from '@/services/utils/split-calculator'
import { useAuthStore } from '@/stores/auth'
import { useExpensesStore } from '@/stores/expenses'
import { useGroupsStore } from '@/stores/groups'
import { useSettlementsStore } from '@/stores/settlements'
import type { Settlement, SettlementStatus, SuggestedDebt } from '@/types'

const props = defineProps<{ f7route: { params: { id: string } } }>()

const auth = useAuthStore()
const groupsStore = useGroupsStore()
const expensesStore = useExpensesStore()
const settlementsStore = useSettlementsStore()

const groupId = props.f7route.params.id
const tab = ref<'owed' | 'owe'>('owed')

const group = computed(() =>
  groupsStore.currentGroup?.id === groupId ? groupsStore.currentGroup : null,
)

/** Server-provided debt graph; falls back to the local greedy calculator when offline. */
const serverBalance = computed(() => settlementsStore.balanceByGroup[groupId] ?? null)
const debts = computed<SuggestedDebt[]>(() => {
  if (serverBalance.value) return serverBalance.value.debts
  return calculateSettlements(expensesStore.expensesFor(groupId))
})

const owedToMe = computed(() => debts.value.filter((d) => d.toUserId === auth.user?.id))
const iOwe = computed(() => debts.value.filter((d) => d.fromUserId === auth.user?.id))
const totalOwedToMe = computed(() => owedToMe.value.reduce((sum, d) => sum + d.amount, 0))
const totalIOwe = computed(() => iOwe.value.reduce((sum, d) => sum + d.amount, 0))

const history = computed(() => settlementsStore.historyByGroup[groupId] ?? [])

function displayName(userId: string) {
  return groupsStore.memberName(group.value, userId)
}

function go(url: string) {
  f7.views.main.router.navigate(url)
}

/** "Запросить" — records a payment request to the debtor (pending settlement). */
async function requestPayment(debt: SuggestedDebt) {
  try {
    await settlementsStore.createSettlement(groupId, {
      fromUserId: debt.fromUserId,
      toUserId: auth.user!.id,
      amount: debt.amount,
      notes: 'Запрос платежа',
    })
    f7.toast
      .create({ text: `Запрос отправлен: ${displayName(debt.fromUserId)}`, position: 'center', closeTimeout: 2000 })
      .open()
    await settlementsStore.fetchHistory(groupId).catch(() => {})
  } catch (e) {
    f7.dialog.alert(apiErrorMessage(e), 'Не удалось создать запрос')
  }
}

/** Off-chain completion works only as counterparty confirmation: the current
 *  user must be a settlement party and NOT the one who created the record. */
function canConfirm(s: Settlement): boolean {
  const me = auth.user?.id
  if (!me || s.status !== 'pending' || s.createdBy === me) return false
  return s.fromUser === me || s.toUser === me
}

async function confirmReceipt(s: Settlement) {
  try {
    await settlementsStore.updateSettlement(s.id, { status: 'completed' })
    await settlementsStore.fetchBalance(groupId).catch(() => {})
    f7.toast
      .create({ text: 'Получение подтверждено', position: 'center', closeTimeout: 1500 })
      .open()
  } catch (e) {
    f7.dialog.alert(apiErrorMessage(e), 'Не удалось подтвердить')
  }
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
function statusColorHex(status: SettlementStatus): string {
  const map: Record<SettlementStatus, string> = {
    pending: '#f59e0b',
    processing: '#3b82f6',
    completed: '#34c77b',
    failed: '#f2507b',
    disputed: '#eab308',
  }
  return map[status]
}
function statusLabel(status: SettlementStatus): string {
  const map: Record<SettlementStatus, string> = {
    pending: 'Ожидает оплаты',
    processing: 'Обрабатывается',
    completed: 'Оплачен',
    failed: 'Ошибка',
    disputed: 'Спор',
  }
  return map[status]
}

async function load() {
  try {
    await settlementsStore.fetchBalance(groupId)
  } catch {
    // Offline fallback: local greedy calculation from cached expenses.
    if (expensesStore.expensesFor(groupId).length === 0) {
      await expensesStore.fetchExpenses(groupId).catch(() => {})
    }
  }
  await settlementsStore.fetchHistory(groupId).catch(() => {})
}

async function refresh(done: () => void) {
  try {
    await load()
  } finally {
    done()
  }
}

onMounted(() => {
  // Always revalidate — membership may have changed since the group was cached.
  void groupsStore.fetchGroup(groupId).catch(() => {})
  void load()
})
</script>
