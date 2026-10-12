<template>
  <f7-page>
    <f7-page-content class="pb-10">
      <div class="flex items-center justify-between px-5 pt-6 pb-2">
        <button type="button" class="sp-icon-btn" @click="back">
          <f7-icon f7="chevron_left" size="20" />
        </button>
        <h1 class="m-0 text-lg font-bold">Расход</h1>
        <button
          v-if="expense"
          type="button"
          class="sp-icon-btn"
          style="color: var(--color-accent)"
          @click="go(`/groups/${groupId}/expenses/new/?edit=${expense.id}`)"
        >
          <f7-icon f7="pencil" size="17" />
        </button>
        <div v-else class="w-10" />
      </div>

      <template v-if="expense">
        <div class="mt-4 px-6">
          <div class="sp-card flex flex-col items-center p-6 text-center">
            <span
              class="mb-3 flex h-14 w-14 items-center justify-center rounded-full"
              :style="{ backgroundColor: `${meta.color}1a`, color: meta.color }"
            >
              <f7-icon :f7="meta.f7Icon" size="26" />
            </span>
            <p class="m-0 text-3xl font-bold">{{ formatUsdc(expense.amount) }}</p>
            <p class="mt-1 mb-0 text-[17px] font-semibold">{{ expense.description }}</p>
            <p class="mt-1 mb-0 text-sm" style="color: var(--color-sub)">
              {{ meta.labelRu }} · {{ formatDateTimeRu(expense.date) }}
            </p>
          </div>
        </div>

        <div class="mt-5 px-6">
          <p class="sp-label">Оплатил</p>
          <div class="sp-card-sm flex items-center gap-3 p-4">
            <UserAvatar :name="displayName(expense.paidBy)" :size="38" />
            <span class="flex-1 font-semibold">{{ displayName(expense.paidBy) }}</span>
            <span class="font-bold">{{ formatUsdc(expense.amount) }}</span>
          </div>
        </div>

        <div class="mt-5 px-6">
          <p class="sp-label">Разделён между {{ expense.splits.length }}</p>
          <div
            v-for="split in expense.splits"
            :key="split.userId"
            class="sp-card-sm mb-2.5 flex items-center gap-3 p-4"
          >
            <UserAvatar :name="displayName(split.userId)" :size="38" />
            <span class="flex-1 font-semibold">{{ displayName(split.userId) }}</span>
            <span class="font-semibold">{{ formatUsdc(split.amount) }}</span>
          </div>
        </div>

        <div v-if="expense.solanaExpensePDA" class="mt-4 px-6 text-center text-xs" style="color: var(--color-sub)">
          On-chain запись:
          <a
            class="break-all"
            style="color: var(--color-accent)"
            :href="`https://explorer.solana.com/address/${expense.solanaExpensePDA}?cluster=${network}`"
            target="_blank"
            rel="noopener"
          >{{ truncateAddress(expense.solanaExpensePDA, 8, 8) }}</a>
        </div>

        <div v-if="canDelete" class="mt-6 px-6">
          <button
            type="button"
            class="w-full rounded-[18px] border-0 py-4 text-[16px] font-semibold"
            style="background: #ffeef3; color: var(--color-rose)"
            @click="confirmDelete"
          >
            Удалить расход
          </button>
        </div>
      </template>

      <div v-else class="flex justify-center py-20">
        <f7-preloader />
      </div>
    </f7-page-content>
  </f7-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { f7 } from 'framework7-vue'
import type { Router } from 'framework7/types'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { categoryMeta } from '@/composables/categories'
import { apiErrorMessage } from '@/services/api'
import { SOLANA_NETWORK } from '@/services/solana'
import { formatDateTimeRu, formatUsdc, truncateAddress } from '@/services/utils/format'
import { useAuthStore } from '@/stores/auth'
import { useExpensesStore } from '@/stores/expenses'
import { useGroupsStore } from '@/stores/groups'
import type { Expense } from '@/types'

const props = defineProps<{
  f7route: { params: { id: string; eid: string } }
  f7router: Router.Router
}>()

const auth = useAuthStore()
const groupsStore = useGroupsStore()
const expensesStore = useExpensesStore()

const groupId = props.f7route.params.id
const expenseId = props.f7route.params.eid
const network = SOLANA_NETWORK

const expense = ref<Expense | null>(
  expensesStore.expensesFor(groupId).find((e) => e.id === expenseId) ?? null,
)
const meta = computed(() => categoryMeta(expense.value?.category ?? 'other'))

const group = computed(() =>
  groupsStore.currentGroup?.id === groupId ? groupsStore.currentGroup : null,
)
const canDelete = computed(
  () =>
    !!expense.value &&
    (expense.value.paidBy === auth.user?.id ||
      group.value?.members.some((m) => m.userId === auth.user?.id && m.role === 'admin')),
)

function displayName(userId: string) {
  return groupsStore.memberName(group.value, userId)
}

function go(url: string) {
  f7.views.main.router.navigate(url)
}

function back() {
  props.f7router.back()
}

function confirmDelete() {
  f7.dialog.confirm('Удалить этот расход? Это действие нельзя отменить.', 'Удалить расход', async () => {
    try {
      await expensesStore.deleteExpense(groupId, expenseId)
      f7.toast.create({ text: 'Расход удалён', position: 'center', closeTimeout: 1500 }).open()
      props.f7router.back()
    } catch (e) {
      f7.dialog.alert(apiErrorMessage(e), 'Не удалось удалить')
    }
  })
}

onMounted(async () => {
  if (!group.value) void groupsStore.fetchGroup(groupId).catch(() => {})
  try {
    expense.value = await expensesStore.fetchExpense(groupId, expenseId)
  } catch {
    // Keep the cached copy if the fetch fails (offline view).
  }
})
</script>
