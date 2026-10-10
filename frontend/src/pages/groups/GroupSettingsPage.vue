<template>
  <f7-page>
    <f7-navbar title="Group settings" back-link="Back" />

    <template v-if="group">
      <f7-list strong inset dividers form @submit.prevent>
        <f7-list-input v-model:value="name" label="Group name" type="text" clear-button />
        <f7-list-input
          v-model:value="description"
          label="Description"
          type="textarea"
          resizable
        />
        <f7-list-item title="Currency" after="USDC (Solana)" />
        <f7-list-item title="Status" :after="group.status" />
      </f7-list>

      <f7-block>
        <f7-button fill round :disabled="!dirty || saving" preloader :loading="saving" @click="save">
          Save changes
        </f7-button>
        <p v-if="errorText" class="mt-3 mb-0 text-center text-sm text-red-500">{{ errorText }}</p>
      </f7-block>

      <f7-block-title>Invite</f7-block-title>
      <f7-list strong inset dividers>
        <f7-list-item title="Invite code" :after="group.metadata?.inviteCode ?? '—'">
          <template #inner-end>
            <f7-button small round outline class="ml-2" @click="copyInvite">Copy</f7-button>
          </template>
        </f7-list-item>
        <f7-list-item link title="Generate new code" @click="regenerate" />
      </f7-list>

      <template v-if="isAdmin">
        <f7-block-title>Danger zone</f7-block-title>
        <f7-list strong inset dividers>
          <f7-list-item
            v-if="group.status === 'active'"
            link
            title="Archive group"
            @click="archive"
          />
          <f7-list-item link title="Delete group" class="text-red-500" @click="confirmDelete" />
        </f7-list>
      </template>

      <f7-block>
        <f7-button outline round color="red" @click="confirmLeave">Leave group</f7-button>
      </f7-block>
    </template>

    <f7-block v-else class="flex justify-center py-16">
      <f7-preloader />
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { f7 } from 'framework7-vue'
import type { Router } from 'framework7/types'
import { apiErrorMessage } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useGroupsStore } from '@/stores/groups'

const props = defineProps<{
  f7route: { params: { id: string } }
  f7router: Router.Router
}>()

const auth = useAuthStore()
const groupsStore = useGroupsStore()

const groupId = props.f7route.params.id
const name = ref('')
const description = ref('')
const saving = ref(false)
const errorText = ref<string | null>(null)

const group = computed(() =>
  groupsStore.currentGroup?.id === groupId ? groupsStore.currentGroup : null,
)
const isAdmin = computed(
  () =>
    group.value?.members.some((m) => m.userId === auth.user?.id && m.role === 'admin') ?? false,
)
const dirty = computed(
  () => name.value !== group.value?.name || description.value !== (group.value?.description ?? ''),
)

watch(
  group,
  (g) => {
    if (g) {
      name.value = g.name
      description.value = g.description ?? ''
    }
  },
  { immediate: true },
)

async function save() {
  saving.value = true
  errorText.value = null
  try {
    await groupsStore.updateGroup(groupId, {
      name: name.value.trim(),
      description: description.value.trim(),
    })
    f7.toast.create({ text: 'Group updated', position: 'center', closeTimeout: 1500 }).open()
  } catch (e) {
    errorText.value = apiErrorMessage(e)
  } finally {
    saving.value = false
  }
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

async function regenerate() {
  try {
    const code = await groupsStore.regenerateInvite(groupId)
    f7.toast
      .create({ text: code ? `New code: ${code}` : 'New invite code generated', position: 'center', closeTimeout: 2500 })
      .open()
  } catch (e) {
    f7.dialog.alert(apiErrorMessage(e), 'Could not generate code')
  }
}

async function archive() {
  try {
    await groupsStore.updateGroup(groupId, { status: 'archived' })
    f7.toast.create({ text: 'Group archived', position: 'center', closeTimeout: 1500 }).open()
    props.f7router.navigate('/groups/', { clearPreviousHistory: true })
  } catch (e) {
    f7.dialog.alert(apiErrorMessage(e), 'Could not archive')
  }
}

function confirmDelete() {
  f7.dialog.confirm(
    'Delete this group and all its expenses? This cannot be undone.',
    'Delete group',
    async () => {
      try {
        await groupsStore.deleteGroup(groupId)
        props.f7router.navigate('/groups/', { clearPreviousHistory: true })
      } catch (e) {
        f7.dialog.alert(apiErrorMessage(e), 'Could not delete')
      }
    },
  )
}

function confirmLeave() {
  f7.dialog.confirm('Leave this group? Your expenses will remain visible to others.', 'Leave group', async () => {
    try {
      await groupsStore.leaveGroup(groupId)
      props.f7router.navigate('/groups/', { clearPreviousHistory: true })
    } catch (e) {
      f7.dialog.alert(apiErrorMessage(e), 'Could not leave')
    }
  })
}

onMounted(() => {
  if (!group.value) void groupsStore.fetchGroup(groupId).catch(() => {})
})
</script>
