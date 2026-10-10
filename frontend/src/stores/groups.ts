import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/services/api'
import type { Group, SplitMethod } from '@/types'

export const useGroupsStore = defineStore('groups', () => {
  const groups = ref<Group[]>([])
  const currentGroup = ref<Group | null>(null)
  const loading = ref(false)

  const activeGroups = computed(() => groups.value.filter((g) => g.status === 'active'))

  async function fetchGroups() {
    loading.value = true
    try {
      const { data } = await api.get<Group[]>('/groups')
      groups.value = data
    } finally {
      loading.value = false
    }
  }

  async function fetchGroup(id: string): Promise<Group> {
    const { data } = await api.get<Group>(`/groups/${id}`)
    currentGroup.value = data
    upsertGroup(data)
    return data
  }

  async function createGroup(input: {
    name: string
    description?: string
    splitMethod?: SplitMethod
  }): Promise<Group> {
    const { data } = await api.post<Group>('/groups', input)
    upsertGroup(data)
    return data
  }

  async function updateGroup(id: string, patch: Partial<Pick<Group, 'name' | 'description' | 'status'>>) {
    const { data } = await api.patch<Group>(`/groups/${id}`, patch)
    upsertGroup(data)
    if (currentGroup.value?.id === id) currentGroup.value = data
    return data
  }

  async function deleteGroup(id: string) {
    await api.delete(`/groups/${id}`)
    groups.value = groups.value.filter((g) => g.id !== id)
    if (currentGroup.value?.id === id) currentGroup.value = null
  }

  async function joinByCode(inviteCode: string, groupId?: string) {
    // The backend accepts a join by invite code; groupId scopes the URL when known.
    const url = groupId ? `/groups/${groupId}/join` : '/groups/join'
    const { data } = await api.post<Group>(url, { inviteCode })
    upsertGroup(data)
    return data
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
    const { data } = await api.post<Group | { inviteCode: string }>(`/groups/${id}/invite`)
    if ('inviteCode' in data && data.inviteCode && currentGroup.value?.id === id) {
      currentGroup.value = {
        ...currentGroup.value,
        metadata: { ...currentGroup.value.metadata, inviteCode: data.inviteCode },
      }
      return data.inviteCode
    }
    if ('id' in data) upsertGroup(data)
    return undefined
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
