<template>
  <f7-page ptr @ptr:refresh="refresh">
    <f7-navbar title="Members" back-link="Back" />

    <f7-block v-if="group?.metadata?.inviteCode" class="my-3">
      <f7-card class="m-0">
        <f7-card-content class="flex items-center justify-between">
          <div>
            <p class="m-0 text-xs uppercase tracking-wide opacity-60">Invite code</p>
            <p class="m-0 text-lg font-bold tracking-widest">{{ group.metadata.inviteCode }}</p>
          </div>
          <div class="flex gap-2">
            <f7-button small round outline @click="copyInvite">Copy</f7-button>
            <f7-button v-if="canShare" small round fill @click="shareInvite">Share</f7-button>
          </div>
        </f7-card-content>
      </f7-card>
    </f7-block>

    <f7-block-title>{{ group?.members.length ?? 0 }} members</f7-block-title>
    <f7-list media-list strong inset dividers>
      <f7-list-item
        v-for="member in group?.members ?? []"
        :key="member.userId"
        :title="displayName(member.userId)"
        :subtitle="member.userId === auth.user?.id ? 'You' : undefined"
        :swipeout="canRemove(member.userId)"
        :after="member.role === 'admin' ? 'Admin' : ''"
      >
        <template #media>
          <UserAvatar :name="displayName(member.userId)" :size="40" />
        </template>
        <f7-swipeout-actions v-if="canRemove(member.userId)" right>
          <f7-swipeout-button color="red" @click="confirmRemove(member.userId)">
            Remove
          </f7-swipeout-button>
        </f7-swipeout-actions>
      </f7-list-item>
    </f7-list>
  </f7-page>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { f7 } from 'framework7-vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { apiErrorMessage } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useGroupsStore } from '@/stores/groups'

const props = defineProps<{ f7route: { params: { id: string } } }>()

const auth = useAuthStore()
const groupsStore = useGroupsStore()

const groupId = props.f7route.params.id

const group = computed(() =>
  groupsStore.currentGroup?.id === groupId ? groupsStore.currentGroup : null,
)
const isAdmin = computed(
  () =>
    group.value?.members.some((m) => m.userId === auth.user?.id && m.role === 'admin') ?? false,
)
const canShare = computed(() => typeof navigator !== 'undefined' && 'share' in navigator)

function displayName(userId: string) {
  return groupsStore.memberName(group.value, userId)
}

function canRemove(userId: string) {
  return isAdmin.value && userId !== auth.user?.id
}

async function copyInvite() {
  const code = group.value?.metadata?.inviteCode
  if (!code) return
  try {
    await navigator.clipboard.writeText(code)
    f7.toast.create({ text: 'Invite code copied', position: 'center', closeTimeout: 1500 }).open()
  } catch {
    f7.dialog.alert(code, 'Invite code')
  }
}

async function shareInvite() {
  const code = group.value?.metadata?.inviteCode
  if (!code) return
  try {
    await navigator.share({
      title: `Join ${group.value?.name} on SplitPay`,
      text: `Join my group "${group.value?.name}" on SplitPay with invite code: ${code}`,
    })
  } catch {
    // User cancelled the share sheet — nothing to do.
  }
}

function confirmRemove(userId: string) {
  f7.dialog.confirm(`Remove ${displayName(userId)} from the group?`, 'Remove member', async () => {
    try {
      await groupsStore.removeMember(groupId, userId)
      f7.toast.create({ text: 'Member removed', position: 'center', closeTimeout: 1500 }).open()
    } catch (e) {
      f7.dialog.alert(apiErrorMessage(e), 'Could not remove member')
    }
  })
}

async function refresh(done: () => void) {
  try {
    await groupsStore.fetchGroup(groupId)
  } finally {
    done()
  }
}

onMounted(() => {
  void groupsStore.fetchGroup(groupId).catch(() => {})
})
</script>
