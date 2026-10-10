<template>
  <f7-page>
    <f7-navbar :title="editingExpense ? 'Edit expense' : 'New expense'" back-link="Cancel" />

    <f7-list strong inset dividers form @submit.prevent>
      <f7-list-input
        v-model:value="description"
        label="Description"
        type="text"
        placeholder="Dinner at the taverna"
        clear-button
      />
      <f7-list-input
        v-model:value="amountText"
        label="Amount (USDC)"
        type="number"
        inputmode="decimal"
        step="0.01"
        min="0"
        placeholder="0.00"
      />
      <f7-list-input
        v-model:value="date"
        label="Date"
        type="date"
      />
    </f7-list>

    <f7-block-title>Category</f7-block-title>
    <f7-block class="my-2 flex flex-wrap gap-2">
      <button
        v-for="cat in CATEGORIES"
        :key="cat.id"
        type="button"
        class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors"
        :class="
          category === cat.id
            ? 'border-transparent text-white'
            : 'border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300'
        "
        :style="category === cat.id ? { backgroundColor: cat.color } : {}"
        @click="category = cat.id"
      >
        <f7-icon :f7="cat.f7Icon" :material="cat.materialIcon" size="16" />
        {{ cat.label }}
      </button>
    </f7-block>

    <f7-block-title>Split</f7-block-title>
    <f7-block class="my-2">
      <f7-segmented strong>
        <f7-button :active="splitMethod === 'equal'" @click="splitMethod = 'equal'">Equal</f7-button>
        <f7-button :active="splitMethod === 'percentage'" @click="splitMethod = 'percentage'">
          Percentage
        </f7-button>
        <f7-button :active="splitMethod === 'custom'" @click="splitMethod = 'custom'">Custom</f7-button>
      </f7-segmented>
    </f7-block>

    <f7-block-title>Split between</f7-block-title>
    <f7-list strong inset dividers>
      <f7-list-item
        v-for="member in members"
        :key="member.userId"
        checkbox
        :checked="selected.has(member.userId)"
        :title="displayName(member.userId)"
        @change="toggleMember(member.userId)"
      >
        <template #media>
          <UserAvatar :name="displayName(member.userId)" :size="32" />
        </template>
        <template #inner-end>
          <div v-if="selected.has(member.userId) && splitMethod === 'percentage'" class="w-24">
            <input
              v-model.number="percentages[member.userId]"
              type="number"
              min="0"
              max="100"
              class="w-full rounded-lg border border-neutral-300 bg-transparent px-2 py-1 text-right dark:border-neutral-700"
              placeholder="%"
            />
          </div>
          <div v-else-if="selected.has(member.userId) && splitMethod === 'custom'" class="w-24">
            <input
              v-model.number="customAmounts[member.userId]"
              type="number"
              min="0"
              step="0.01"
              class="w-full rounded-lg border border-neutral-300 bg-transparent px-2 py-1 text-right dark:border-neutral-700"
              placeholder="0.00"
            />
          </div>
          <span v-else-if="selected.has(member.userId)" class="text-sm opacity-60">
            {{ formatUsdc(previewAmount(member.userId)) }}
          </span>
        </template>
      </f7-list-item>
    </f7-list>

    <f7-block v-if="splitError" class="my-2 text-sm text-red-500">{{ splitError }}</f7-block>
    <f7-block v-else-if="amount > 0 && selected.size > 0" class="my-2 text-sm opacity-60">
      {{ selected.size }} {{ selected.size === 1 ? 'person' : 'people' }} ·
      {{ formatUsdc(amount / selected.size) }} each on average
    </f7-block>

    <f7-block>
      <f7-button large fill round preloader :loading="saving" :disabled="!canSubmit" @click="submit">
        {{ editingExpense ? 'Save changes' : 'Add expense' }}
      </f7-button>
      <p v-if="errorText" class="mt-3 mb-0 text-center text-sm text-red-500">{{ errorText }}</p>
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { f7 } from 'framework7-vue'
import type { Router } from 'framework7/types'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { CATEGORIES } from '@/composables/categories'
import { apiErrorMessage } from '@/services/api'
import { formatUsdc } from '@/services/utils/format'
import { splitEqually } from '@/services/utils/split-calculator'
import { useExpensesStore } from '@/stores/expenses'
import { useGroupsStore } from '@/stores/groups'
import type { ExpenseCategory, ExpenseSplit, SplitMethod } from '@/types'

const props = defineProps<{
  f7route: { params: { id: string }; query: { edit?: string } }
  f7router: Router.Router
}>()

const groupsStore = useGroupsStore()
const expensesStore = useExpensesStore()

const groupId = props.f7route.params.id
const editId = props.f7route.query.edit

const description = ref('')
const amountText = ref('')
const date = ref(new Date().toISOString().slice(0, 10))
const category = ref<ExpenseCategory>('other')
const splitMethod = ref<SplitMethod>('equal')
const selected = reactive(new Set<string>())
const percentages = reactive<Record<string, number>>({})
const customAmounts = reactive<Record<string, number>>({})
const saving = ref(false)
const errorText = ref<string | null>(null)

const editingExpense = computed(() =>
  editId ? expensesStore.expensesFor(groupId).find((e) => e.id === editId) ?? null : null,
)

const group = computed(() =>
  groupsStore.currentGroup?.id === groupId ? groupsStore.currentGroup : null,
)
const members = computed(() => group.value?.members ?? [])

const amount = computed(() => {
  const value = parseFloat(amountText.value)
  return Number.isFinite(value) && value > 0 ? value : 0
})

function displayName(userId: string) {
  return groupsStore.memberName(group.value, userId)
}

function toggleMember(userId: string) {
  if (selected.has(userId)) selected.delete(userId)
  else {
    selected.add(userId)
    percentages[userId] ??= Math.round(100 / (selected.size || 1))
  }
}

/** Live preview of one member's equal share. */
function previewAmount(userId: string): number {
  if (splitMethod.value !== 'equal') return 0
  const splits = splitEqually(amount.value, [...selected])
  return splits.find((s) => s.userId === userId)?.amount ?? 0
}

const splits = computed<ExpenseSplit[]>(() => {
  const ids = [...selected]
  if (amount.value <= 0 || ids.length === 0) return []
  try {
    if (splitMethod.value === 'equal') return splitEqually(amount.value, ids)
    if (splitMethod.value === 'percentage') {
      const total = ids.reduce((sum, id) => sum + (percentages[id] ?? 0), 0)
      return ids.map((userId) => ({
        userId,
        percentage: percentages[userId] ?? 0,
        amount: Math.round((amount.value * (percentages[userId] ?? 0)) / (total || 100) * 1e6) / 1e6,
      }))
    }
    return ids.map((userId) => ({ userId, amount: customAmounts[userId] ?? 0 }))
  } catch {
    return []
  }
})

const splitError = computed(() => {
  if (splitMethod.value === 'percentage' && selected.size > 0) {
    const total = [...selected].reduce((sum, id) => sum + (percentages[id] ?? 0), 0)
    if (Math.abs(total - 100) > 0.01) return `Percentages add up to ${total}%, must be 100%`
  }
  if (splitMethod.value === 'custom' && amount.value > 0) {
    const total = splits.value.reduce((sum, s) => sum + s.amount, 0)
    if (Math.abs(total - amount.value) > 0.000001)
      return `Shares add up to ${formatUsdc(total)}, expense is ${formatUsdc(amount.value)}`
  }
  return null
})

const canSubmit = computed(
  () =>
    description.value.trim().length > 0 &&
    amount.value > 0 &&
    selected.size > 0 &&
    !splitError.value &&
    !saving.value,
)

onMounted(async () => {
  if (!group.value) await groupsStore.fetchGroup(groupId).catch(() => {})

  if (editingExpense.value) {
    const expense = editingExpense.value
    description.value = expense.description
    amountText.value = String(expense.amount)
    date.value = expense.date.slice(0, 10)
    category.value = expense.category
    for (const split of expense.splits) {
      selected.add(split.userId)
      if (split.percentage != null) percentages[split.userId] = split.percentage
      customAmounts[split.userId] = split.amount
    }
    if (expense.splits.some((s) => s.percentage != null)) splitMethod.value = 'percentage'
  } else {
    // Default: split between everyone, current user included.
    for (const member of members.value) selected.add(member.userId)
  }
})

async function submit() {
  saving.value = true
  errorText.value = null
  const draft = {
    description: description.value.trim(),
    amount: amount.value,
    category: category.value,
    date: new Date(date.value).toISOString(),
    splits: splits.value,
  }
  try {
    if (editingExpense.value) {
      await expensesStore.updateExpense(groupId, editingExpense.value.id, draft)
    } else {
      await expensesStore.createExpense(groupId, draft)
    }
    f7.toast
      .create({ text: editingExpense.value ? 'Expense updated' : 'Expense added', position: 'center', closeTimeout: 1500 })
      .open()
    props.f7router.back()
  } catch (e) {
    errorText.value = apiErrorMessage(e)
  } finally {
    saving.value = false
  }
}
</script>
