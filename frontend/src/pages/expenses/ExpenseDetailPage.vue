<template>
  <f7-page>
    <f7-navbar title="Expense" back-link="Expenses">
      <template #right>
        <f7-link
          v-if="expense"
          icon-f7="pencil"
          icon-material="edit"
          :href="`/groups/${groupId}/expenses/new/?edit=${expense.id}`"
        />
      </template>
    </f7-navbar>

    <template v-if="expense">
      <f7-card class="mx-4 mt-4">
        <f7-card-content class="flex flex-col items-center py-6 text-center">
          <div
            class="mb-3 flex h-14 w-14 items-center justify-center rounded-full"
            :style="{ backgroundColor: `${meta.color}22`, color: meta.color }"
          >
            <f7-icon :f7="meta.f7Icon" :material="meta.materialIcon" size="28" />
          </div>
          <p class="m-0 text-3xl font-bold">{{ formatUsdc(expense.amount) }}</p>
          <p class="mt-1 mb-0 text-lg">{{ expense.description }}</p>
          <p class="mt-1 mb-0 text-sm opacity-60">
            {{ meta.label }} · {{ formatDateTime(expense.date) }}
          </p>
        </f7-card-content>
      </f7-card>

      <f7-block-title>Paid by</f7-block-title>
      <f7-list strong inset>
        <f7-list-item :title="displayName(expense.paidBy)" :after="formatUsdc(expense.amount)">
          <template #media>
            <UserAvatar :name="displayName(expense.paidBy)" :size="36" />
          </template>
        </f7-list-item>
      </f7-list>

      <f7-block-title>Split between {{ expense.splits.length }}</f7-block-title>
      <f7-list strong inset dividers>
        <f7-list-item
          v-for="split in expense.splits"
          :key="split.userId"
          :title="displayName(split.userId)"
          :after="formatUsdc(split.amount)"
        >
          <template #media>
            <UserAvatar :name="displayName(split.userId)" :size="36" />
          </template>
          <template v-if="split.percentage != null" #subtitle>{{ split.percentage }}%</template>
        </f7-list-item>
      </f7-list>

      <f7-block v-if="expense.solanaExpensePDA" class="text-sm opacity-60">
        On-chain record:
        <a
          class="break-all text-brand-500"
          :href="`https://explorer.solana.com/address/${expense.solanaExpensePDA}?cluster=${solanaNetwork}`"
          target="_blank"
          rel="noopener"
        >
          {{ truncateAddress(expense.solanaExpensePDA, 8, 8) }}
        </a>
      </f7-block>

      <f7-block v-if="canDelete">
        <f7-button large outline round color="red" @click="confirmDelete">Delete expense</f7-button>
      </f7-block>
    </template>

    <f7-block v-else class="flex justify-center py-16">
      <f7-preloader />
    </f7-block>
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
import { formatDateTime, formatUsdc, truncateAddress } from '@/services/utils/format'
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
const solanaNetwork = SOLANA_NETWORK

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

function confirmDelete() {
  f7.dialog.confirm('Delete this expense? This cannot be undone.', 'Delete expense', async () => {
    try {
      await expensesStore.deleteExpense(groupId, expenseId)
      f7.toast.create({ text: 'Expense deleted', position: 'center', closeTimeout: 1500 }).open()
      props.f7router.back()
    } catch (e) {
      f7.dialog.alert(apiErrorMessage(e), 'Could not delete')
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
