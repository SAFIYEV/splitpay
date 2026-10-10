<template>
  <f7-page ptr @ptr:refresh="refresh">
    <f7-navbar title="Expenses" :back-link="group?.name ?? 'Back'">
      <template #subnavbar>
        <f7-searchbar
          v-model:value="query"
          search-container=".expenses-list"
          search-in=".item-title, .item-subtitle"
          placeholder="Search expenses"
          disable-button-text="Cancel"
        />
      </template>
    </f7-navbar>

    <template v-for="[day, items] in groupedExpenses" :key="day">
      <f7-block-title>{{ day }}</f7-block-title>
      <f7-list media-list strong inset class="expenses-list">
        <ExpenseListItem
          v-for="expense in items"
          :key="expense.id"
          :expense="expense"
          :group-id="groupId"
          :member-name="displayName"
          @edit="(e) => f7router.navigate(`/groups/${groupId}/expenses/new/?edit=${e.id}`)"
          @delete="confirmDelete"
        />
      </f7-list>
    </template>

    <EmptyState
      v-if="groupedExpenses.length === 0 && !expensesStore.loading"
      icon="receipt"
      material-icon="receipt_long"
      title="No expenses yet"
      text="Tap + to add the first shared expense."
    />

    <f7-fab position="right-bottom" :href="`/groups/${groupId}/expenses/new/`">
      <f7-icon f7="plus" material="add" />
    </f7-fab>
  </f7-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { f7 } from 'framework7-vue'
import type { Router } from 'framework7/types'
import EmptyState from '@/components/common/EmptyState.vue'
import ExpenseListItem from '@/components/expenses/ExpenseListItem.vue'
import { apiErrorMessage } from '@/services/api'
import { formatDate } from '@/services/utils/format'
import { useExpensesStore } from '@/stores/expenses'
import { useGroupsStore } from '@/stores/groups'
import type { Expense } from '@/types'

const props = defineProps<{
  f7route: { params: { id: string } }
  f7router: Router.Router
}>()

const expensesStore = useExpensesStore()
const groupsStore = useGroupsStore()

const groupId = props.f7route.params.id
const query = ref('')

const group = computed(() =>
  groupsStore.currentGroup?.id === groupId ? groupsStore.currentGroup : null,
)

/** Expenses grouped by calendar day, newest first. */
const groupedExpenses = computed<[string, Expense[]][]>(() => {
  const groups = new Map<string, Expense[]>()
  const sorted = [...expensesStore.expensesFor(groupId)].sort(
    (a, b) => +new Date(b.date) - +new Date(a.date),
  )
  for (const expense of sorted) {
    const day = formatDate(expense.date)
    const list = groups.get(day) ?? []
    list.push(expense)
    groups.set(day, list)
  }
  return [...groups.entries()]
})

function displayName(userId: string) {
  return groupsStore.memberName(group.value, userId)
}

function confirmDelete(expense: Expense) {
  f7.dialog.confirm(`Delete "${expense.description}"? This cannot be undone.`, 'Delete expense', async () => {
    try {
      await expensesStore.deleteExpense(groupId, expense.id)
      f7.toast.create({ text: 'Expense deleted', position: 'center', closeTimeout: 1500 }).open()
    } catch (e) {
      f7.dialog.alert(apiErrorMessage(e), 'Could not delete')
    }
  })
}

async function refresh(done: () => void) {
  try {
    await expensesStore.fetchExpenses(groupId)
  } finally {
    done()
  }
}

onMounted(() => {
  if (!group.value) void groupsStore.fetchGroup(groupId).catch(() => {})
  void expensesStore.fetchExpenses(groupId).catch(() => {})
})
</script>
