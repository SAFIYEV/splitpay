<template>
  <f7-page ptr @ptr:refresh="refresh">
    <f7-page-content class="pb-28">
      <div class="flex items-center justify-between px-5 pt-6 pb-2">
        <button type="button" class="sp-icon-btn" @click="go(`/groups/${groupId}/`)">
          <f7-icon f7="chevron_left" size="20" />
        </button>
        <h1 class="m-0 text-lg font-bold">Расходы</h1>
        <button type="button" class="sp-icon-btn" style="color: var(--color-accent)" @click="go(`/groups/${groupId}/expenses/new/`)">
          <f7-icon f7="plus" size="18" />
        </button>
      </div>

      <div class="px-6">
        <input v-model="query" type="text" class="sp-input mb-4" placeholder="Поиск расходов" />

        <template v-if="filtered.length > 0">
          <div
            v-for="expense in filtered"
            :key="expense.id"
            class="sp-card-sm mb-3 flex items-center gap-3 p-4"
          >
            <button type="button" class="flex min-w-0 flex-1 items-center gap-3 border-0 bg-transparent p-0 text-left" @click="go(`/groups/${groupId}/expenses/${expense.id}/`)">
              <span
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                :style="{ backgroundColor: `${categoryMeta(expense.category).color}1a`, color: categoryMeta(expense.category).color }"
              >
                <f7-icon :f7="categoryMeta(expense.category).f7Icon" size="20" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate font-semibold">{{ expense.description }}</span>
                <span class="block text-xs" style="color: var(--color-sub)">
                  {{ displayName(expense.paidBy) }} · {{ formatDateRu(expense.date) }}
                </span>
              </span>
              <span class="sp-positive text-[15px] font-bold">{{ formatUsdc(expense.amount) }}</span>
            </button>
            <button
              type="button"
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-0"
              style="background: #ffeef3; color: var(--color-rose)"
              @click="confirmDelete(expense)"
            >
              <f7-icon f7="trash" size="14" />
            </button>
          </div>
        </template>

        <div v-else class="sp-card p-8 text-center">
          <p class="m-0 mb-1 font-semibold">Расходов пока нет</p>
          <p class="m-0 text-sm" style="color: var(--color-sub)">Нажмите +, чтобы добавить первый.</p>
        </div>
      </div>
    </f7-page-content>
  </f7-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { f7 } from 'framework7-vue'
import { categoryMeta } from '@/composables/categories'
import { apiErrorMessage } from '@/services/api'
import { formatDateRu, formatUsdc } from '@/services/utils/format'
import { useExpensesStore } from '@/stores/expenses'
import { useGroupsStore } from '@/stores/groups'
import type { Expense } from '@/types'

const props = defineProps<{ f7route: { params: { id: string } } }>()

const expensesStore = useExpensesStore()
const groupsStore = useGroupsStore()

const groupId = props.f7route.params.id
const query = ref('')

const group = computed(() =>
  groupsStore.currentGroup?.id === groupId ? groupsStore.currentGroup : null,
)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = [...expensesStore.expensesFor(groupId)].sort((a, b) => +new Date(b.date) - +new Date(a.date))
  if (!q) return list
  return list.filter((e) => e.description.toLowerCase().includes(q))
})

function displayName(userId: string) {
  return groupsStore.memberName(group.value, userId)
}

function go(url: string) {
  f7.views.main.router.navigate(url)
}

function confirmDelete(expense: Expense) {
  f7.dialog.confirm(`Удалить «${expense.description}»? Это действие нельзя отменить.`, 'Удалить расход', async () => {
    try {
      await expensesStore.deleteExpense(groupId, expense.id)
      f7.toast.create({ text: 'Расход удалён', position: 'center', closeTimeout: 1500 }).open()
    } catch (e) {
      f7.dialog.alert(apiErrorMessage(e), 'Не удалось удалить')
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
