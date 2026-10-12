import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/services/api'
import { normalizeArray, normalizeGroup } from '@/services/normalize'
import type { Group, SplitMethod } from '@/types'

export const useGroupsStore = defineStore('groups', () => {
  const groups = ref<Group[]>([])
  const currentGroup = ref<Group | null>(null)
  const loading = ref(false)

  const activeGroups = computed(() => groups.value.filter((g) => g.status === 'active'))

  async function fetchGroups() {
    loading.value = true
    try {
      const { data } = await api.get<unknown>('/groups')
      groups.value = normalizeArray(data, normalizeGroup)
    } finally {
      loading.value = false
    }
  }

  async function fetchGroup(id: string): Promise<Group> {
    const { data } = await api.get<unknown>(`/groups/${id}`)
    const group = normalizeGroup(data)
    currentGroup.value = group
    upsertGroup(group)
    return group
  }

  async function createGroup(input: {
    name: string
    description?: string
    splitMethod?: SplitMethod
  }): Promise<Group> {
    const { data } = await api.post<unknown>('/groups', input)
    const group = normalizeGroup(data)
    upsertGroup(group)
    return group
  }

  async function updateGroup(id: string, patch: Partial<Pick<Group, 'name' | 'description' | 'status'>>) {
    const { data } = await api.patch<unknown>(`/groups/${id}`, patch)
    const group = normalizeGroup(data)
    upsertGroup(group)
    if (currentGroup.value?.id === id) currentGroup.value = group
    return group
  }

  async function deleteGroup(id: string) {
    await api.delete(`/groups/${id}`)
    groups.value = groups.value.filter((g) => g.id !== id)
    if (currentGroup.value?.id === id) currentGroup.value = null
  }

  async function joinByCode(inviteCode: string, groupId?: string) {
    // The backend accepts a join by invite code; groupId scopes the URL when known.
    const url = groupId ? `/groups/${groupId}/join` : '/groups/join'
    const { data } = await api.post<unknown>(url, { inviteCode })
    const group = normalizeGroup(data)
    upsertGroup(group)
    return group
  }

  async function leaveGroup(id: string) {
    await api.post(`/groups/${id}/leave`)
    groups.value = groups.value.filter((g) => g.id !== id)
    if (currentGroup.value?.id === id) currentGroup.value = null
  }

  async function removeMember(groupId: string, userId: string) {
    await api.delete(`/groups/${groupId}/members/${userId}`)
    if (currentGroup.value?.id === groupId) {
      currentGroup.value = {
        ...currentGroup.value,
        members: currentGroup.value.members.filter((m) => m.userId !== userId),
      }
    }
  }

  async function regenerateInvite(id: string): Promise<string | undefined> {
    const { data } = await api.post<unknown>(`/groups/${id}/invite`)
    const code =
      (data as { inviteCode?: string })?.inviteCode ??
      normalizeGroup(data).inviteCode
    if (code && currentGroup.value?.id === id) {
      currentGroup.value = { ...currentGroup.value, inviteCode: code }
      const idx = groups.value.findIndex((g) => g.id === id)
      if (idx >= 0) groups.value[idx] = { ...groups.value[idx]!, inviteCode: code }
    }
    return code
  }

  function upsertGroup(group: Group) {
    const idx = groups.value.findIndex((g) => g.id === group.id)
    if (idx >= 0) groups.value[idx] = group
    else groups.value.push(group)
  }

  /** Display name of a member inside a group (nickname > user display name > id). */
  function memberName(group: Group | null, userId: string): string {
    const member = group?.members.find((m) => m.userId === userId)
    return member?.nickname ?? member?.user?.displayName ?? userId.slice(0, 6)
  }

  return {
    groups,
    currentGroup,
    loading,
    activeGroups,
    fetchGroups,
    fetchGroup,
    createGroup,
    updateGroup,
    deleteGroup,
    joinByCode,
    leaveGroup,
    removeMember,
    regenerateInvite,
    upsertGroup,
    memberName,
  }
})
