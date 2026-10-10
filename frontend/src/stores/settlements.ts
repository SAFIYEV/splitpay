import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/services/api'
import type { GroupBalance, Settlement, SettlementStatus } from '@/types'

export const useSettlementsStore = defineStore('settlements', () => {
  const balanceByGroup = ref<Record<string, GroupBalance>>({})
  const historyByGroup = ref<Record<string, Settlement[]>>({})
  const loading = ref(false)

  /** Net balances + minimal debt graph for a group (GET /groups/:id/settlements/balance). */
  async function fetchBalance(groupId: string): Promise<GroupBalance> {
    loading.value = true
    try {
      const { data } = await api.get<GroupBalance>(`/groups/${groupId}/settlements/balance`)
      balanceByGroup.value[groupId] = normalizeBalance(data)
      return balanceByGroup.value[groupId]!
    } finally {
      loading.value = false
    }
  }

  async function fetchHistory(groupId: string): Promise<Settlement[]> {
    const { data } = await api.get<Settlement[]>(`/groups/${groupId}/settlements`)
    historyByGroup.value[groupId] = data
    return data
  }

  /** Create a settlement request (a payment the current user intends to make). */
  async function createSettlement(
    groupId: string,
    input: { toUser: string; amount: number; notes?: string },
  ): Promise<Settlement> {
    const { data } = await api.post<Settlement>(`/groups/${groupId}/settlements`, input)
    upsertHistory(groupId, data)
    return data
  }

  async function updateSettlement(id: string, patch: { status?: SettlementStatus; notes?: string }) {
    const { data } = await api.patch<Settlement>(`/settlements/${id}`, patch)
    upsertHistory(data.groupId, data)
    return data
  }

  /** Step 1 of the on-chain payment flow: get a prepared transaction to sign. */
  async function prepareTransaction(id: string): Promise<{ transaction: string }> {
    const { data } = await api.post<{ transaction: string }>(`/settlements/${id}/prepare-tx`)
    return data
  }

  /** Step 2: report the on-chain signature after the signed tx was broadcast. */
  async function confirmSettlement(id: string, signature: string): Promise<Settlement> {
    const { data } = await api.post<Settlement>(`/settlements/${id}/confirm`, { signature })
    upsertHistory(data.groupId, data)
    return data
  }

  /** Re-check the on-chain status of a settlement. */
  async function verifySettlement(id: string): Promise<Settlement> {
    const { data } = await api.get<Settlement>(`/settlements/${id}/verify`)
    upsertHistory(data.groupId, data)
    return data
  }

  function upsertHistory(groupId: string, settlement: Settlement) {
    const list = historyByGroup.value[groupId] ?? (historyByGroup.value[groupId] = [])
    const idx = list.findIndex((s) => s.id === settlement.id)
    if (idx >= 0) list[idx] = settlement
    else list.unshift(settlement)
  }

  /** Tolerate slightly different backend shapes (`debts` vs `settlements` key). */
  function normalizeBalance(raw: GroupBalance & { settlements?: GroupBalance['debts'] }): GroupBalance {
    return {
      balances: raw.balances ?? [],
      debts: raw.debts ?? raw.settlements ?? [],
    }
  }

  return {
    balanceByGroup,
    historyByGroup,
    loading,
    fetchBalance,
    fetchHistory,
    createSettlement,
    updateSettlement,
    prepareTransaction,
    confirmSettlement,
    verifySettlement,
    upsertHistory,
  }
})
