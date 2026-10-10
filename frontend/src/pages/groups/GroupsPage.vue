<template>
  <f7-page ptr @ptr:refresh="refresh">
    <f7-navbar title="SplitPay">
      <template #right>
        <f7-link href="/activity/" icon-f7="bell" icon-material="notifications" class="relative">
          <f7-badge v-if="notifications.unreadCount > 0" color="red" class="absolute -top-1 -right-1">
            {{ notifications.unreadCount }}
          </f7-badge>
        </f7-link>
        <f7-link href="/profile/" icon-f7="person_circle" icon-material="account_circle" />
      </template>
    </f7-navbar>

    <f7-block class="my-4 flex items-center justify-between">
      <div>
        <h2 class="m-0 text-xl font-bold">Your groups</h2>
        <p class="m-0 text-sm opacity-60">{{ groupsStore.activeGroups.length }} active</p>
      </div>
      <f7-button small outline round @click="joinByCode">
        <f7-icon f7="qrcode" material="key" size="16" class="mr-1" />
        Join by code
      </f7-button>
    </f7-block>

    <f7-list v-if="groupsStore.activeGroups.length > 0" media-list strong inset>
      <f7-list-item
        v-for="group in groupsStore.activeGroups"
        :key="group.id"
        :link="`/groups/${group.id}/`"
        :title="group.name"
        :subtitle="group.description || `${group.members.length} members`"
        :after="formatUsdc(group.totalSpent)"
      >
        <template #media>
          <UserAvatar :name="group.name" :size="44" />
        </template>
        <template #footer>
          <span class="opacity-50">{{ group.members.length }} members</span>
        </template>
      </f7-list-item>
    </f7-list>

    <EmptyState
      v-else
      icon="person_3_fill"
      material-icon="group"
      title="No groups yet"
      text="Create a group for your next trip, shared flat or team outing."
    >
      <f7-button fill round href="/groups/new/">Create your first group</f7-button>
    </EmptyState>

    <f7-fab position="right-bottom" href="/groups/new/">
      <f7-icon f7="plus" material="add" />
    </f7-fab>
  </f7-page>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { f7 } from 'framework7-vue'
import EmptyState from '@/components/common/EmptyState.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { apiErrorMessage } from '@/services/api'
import { formatUsdc } from '@/services/utils/format'
import { useGroupsStore } from '@/stores/groups'
import { useNotificationsStore } from '@/stores/notifications'

const groupsStore = useGroupsStore()
const notifications = useNotificationsStore()

onMounted(() => {
  void groupsStore.fetchGroups().catch(() => {})
  void notifications.fetchNotifications().catch(() => {})
})

async function refresh(done: () => void) {
  try {
    await Promise.allSettled([groupsStore.fetchGroups(), notifications.fetchNotifications()])
  } finally {
    done()
  }
}

function joinByCode() {
  f7.dialog.prompt('Enter the invite code you received:', 'Join group', async (code) => {
    if (!code.trim()) return
    try {
      const group = await groupsStore.joinByCode(code.trim())
      f7.toast.create({ text: `Joined "${group.name}"`, position: 'center', closeTimeout: 2000 }).open()
      f7.views.main.router.navigate(`/groups/${group.id}/`)
    } catch (e) {
      f7.dialog.alert(apiErrorMessage(e), 'Could not join')
    }
  })
}
</script>
