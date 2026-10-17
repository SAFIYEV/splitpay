import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/services/api'
import { normalizeArray, normalizeBalance, normalizeSettlement } from '@/services/normalize'
import type { GroupBalance, Settlement, SettlementStatus } from '@/types'

export const useSettlementsStore = defineStore('settlements', () => {
  const balanceByGroup = ref<Record<string, GroupBalance>>({})
  const historyByGroup = ref<Record<string, Settlement[]>>({})
  const loading = ref(false)

  /** Net balances + minimal debt graph for a group (GET /groups/:id/settlements/balance). */
  async function fetchBalance(groupId: string): Promise<GroupBalance> {
    loading.value = true
    try {
      const { data } = await api.get<unknown>(`/groups/${groupId}/settlements/balance`)
      balanceByGroup.value[groupId] = normalizeBalance(data)
      return balanceByGroup.value[groupId]!
    } finally {
      loading.value = false
    }
  }

  async function fetchHistory(groupId: string): Promise<Settlement[]> {
    const { data } = await api.get<unknown>(`/groups/${groupId}/settlements`)
    const list = normalizeArray(data, normalizeSettlement)
    historyByGroup.value[groupId] = list
    return list
  }

  /**
   * Create a settlement. Default: current user pays `toUserId`.
   * `fromUserId` may be set to another member when recording a repayment
   * received from them (backend allows it when you are the recipient).
   */
  async function createSettlement(
    groupId: string,
    input: { toUserId: string; fromUserId?: string; amount: number; notes?: string },
  ): Promise<Settlement> {
    const { data } = await api.post<unknown>(`/groups/${groupId}/settlements`, input)
    const settlement = normalizeSettlement(data)
    upsertHistory(groupId, settlement)
    return settlement
  }

  async function updateSettlement(id: string, patch: { status?: SettlementStatus; notes?: string }) {
    const { data } = await api.patch<unknown>(`/settlements/${id}`, patch)
    const settlement = normalizeSettlement(data)
    upsertHistory(settlement.groupId, settlement)
    return settlement
  }

  /** Step 1 of the on-chain payment flow: get a prepared transaction to sign. */
  async function prepareTransaction(id: string): Promise<{
    transaction: string
    fromTokenAccount: string
    toTokenAccount: string
  }> {
    const { data } = await api.post<{
      transaction: string
      fromTokenAccount: string
      toTokenAccount: string
    }>(`/settlements/${id}/prepare-tx`)
    return data
  }

  /** Step 2: report the on-chain signature after the signed tx was broadcast. */
  async function confirmSettlement(id: string, signature: string): Promise<Settlement> {
    const { data } = await api.post<unknown>(`/settlements/${id}/confirm`, { signature })
    const settlement = normalizeSettlement(data)
    upsertHistory(settlement.groupId, settlement)
    return settlement
  }

  /** Re-check the on-chain status of a settlement. */
  async function verifySettlement(id: string): Promise<Settlement> {
    const { data } = await api.get<unknown>(`/settlements/${id}/verify`)
    const settlement = normalizeSettlement(data)
    upsertHistory(settlement.groupId, settlement)
    return settlement
  }

  function upsertHistory(groupId: string, settlement: Settlement) {
    const normalized = normalizeSettlement(settlement)
    const list = historyByGroup.value[groupId] ?? (historyByGroup.value[groupId] = [])
    const idx = list.findIndex((s) => s.id === normalized.id)
    if (idx >= 0) list[idx] = normalized
    else list.unshift(normalized)
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
