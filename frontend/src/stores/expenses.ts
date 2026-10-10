import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/services/api'
import type { Expense, ExpenseDraft } from '@/types'

export const useExpensesStore = defineStore('expenses', () => {
  const expensesByGroup = ref<Record<string, Expense[]>>({})
  const loading = ref(false)

  async function fetchExpenses(groupId: string): Promise<Expense[]> {
    loading.value = true
    try {
      const { data } = await api.get<Expense[]>(`/groups/${groupId}/expenses`)
      expensesByGroup.value[groupId] = data
      return data
    } finally {
      loading.value = false
    }
  }

  async function fetchExpense(groupId: string, expenseId: string): Promise<Expense> {
    const { data } = await api.get<Expense>(`/groups/${groupId}/expenses/${expenseId}`)
    upsertExpense(groupId, data)
    return data
  }

  async function createExpense(groupId: string, draft: ExpenseDraft): Promise<Expense> {
    const { data } = await api.post<Expense>(`/groups/${groupId}/expenses`, draft)
    upsertExpense(groupId, data)
    return data
  }

  async function updateExpense(
    groupId: string,
    expenseId: string,
    patch: Partial<ExpenseDraft>,
  ): Promise<Expense> {
    const { data } = await api.patch<Expense>(`/groups/${groupId}/expenses/${expenseId}`, patch)
    upsertExpense(groupId, data)
    return data
  }

  async function deleteExpense(groupId: string, expenseId: string) {
    await api.delete(`/groups/${groupId}/expenses/${expenseId}`)
    removeExpense(groupId, expenseId)
  }

  function upsertExpense(groupId: string, expense: Expense) {
    const list = expensesByGroup.value[groupId] ?? (expensesByGroup.value[groupId] = [])
    const idx = list.findIndex((e) => e.id === expense.id)
    if (idx >= 0) list[idx] = expense
    else list.unshift(expense)
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
