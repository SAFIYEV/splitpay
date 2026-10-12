import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/services/api'
import { normalizeArray, normalizeExpense } from '@/services/normalize'
import type { Expense, ExpenseDraft } from '@/types'

export const useExpensesStore = defineStore('expenses', () => {
  const expensesByGroup = ref<Record<string, Expense[]>>({})
  const loading = ref(false)

  async function fetchExpenses(groupId: string): Promise<Expense[]> {
    loading.value = true
    try {
      const { data } = await api.get<unknown>(`/groups/${groupId}/expenses`)
      const list = normalizeArray(data, normalizeExpense)
      expensesByGroup.value[groupId] = list
      return list
    } finally {
      loading.value = false
    }
  }

  async function fetchExpense(groupId: string, expenseId: string): Promise<Expense> {
    const { data } = await api.get<unknown>(`/groups/${groupId}/expenses/${expenseId}`)
    const expense = normalizeExpense(data)
    upsertExpense(groupId, expense)
    return expense
  }

  async function createExpense(groupId: string, draft: ExpenseDraft): Promise<Expense> {
    const { data } = await api.post<unknown>(`/groups/${groupId}/expenses`, draft)
    const expense = normalizeExpense(data)
    upsertExpense(groupId, expense)
    return expense
  }

  async function updateExpense(
    groupId: string,
    expenseId: string,
    patch: Partial<ExpenseDraft>,
  ): Promise<Expense> {
    const { data } = await api.patch<unknown>(`/groups/${groupId}/expenses/${expenseId}`, patch)
    const expense = normalizeExpense(data)
    upsertExpense(groupId, expense)
    return expense
  }

  async function deleteExpense(groupId: string, expenseId: string) {
    await api.delete(`/groups/${groupId}/expenses/${expenseId}`)
    removeExpense(groupId, expenseId)
  }

  function upsertExpense(groupId: string, expense: Expense) {
    const normalized = normalizeExpense(expense)
    const list = expensesByGroup.value[groupId] ?? (expensesByGroup.value[groupId] = [])
    const idx = list.findIndex((e) => e.id === normalized.id)
    if (idx >= 0) list[idx] = normalized
    else list.unshift(normalized)
  }

  function removeExpense(groupId: string, expenseId: string) {
    const list = expensesByGroup.value[groupId]
    if (list) expensesByGroup.value[groupId] = list.filter((e) => e.id !== expenseId)
  }

  function expensesFor(groupId: string): Expense[] {
    return expensesByGroup.value[groupId] ?? []
  }

  return {
    expensesByGroup,
    loading,
    fetchExpenses,
    fetchExpense,
    createExpense,
    updateExpense,
    deleteExpense,
    upsertExpense,
    removeExpense,
    expensesFor,
  }
})
