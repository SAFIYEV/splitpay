<template>
  <f7-page>
    <f7-navbar title="New group" back-link="Back" />

    <f7-block class="mb-2">
      <p class="m-0 opacity-70">
        A group is where you track shared expenses — a trip, a flat, a team dinner.
      </p>
    </f7-block>

    <f7-list strong inset dividers form @submit.prevent>
      <f7-list-input
        v-model:value="name"
        label="Group name"
        type="text"
        placeholder="Lisbon trip 2026"
        clear-button
      />
      <f7-list-input
        v-model:value="description"
        label="Description"
        type="textarea"
        placeholder="Optional — what is this group for?"
        resizable
      />
    </f7-list>

    <f7-block-title>Default split method</f7-block-title>
    <f7-block>
      <f7-segmented strong>
        <f7-button :active="splitMethod === 'equal'" @click="splitMethod = 'equal'">Equal</f7-button>
        <f7-button :active="splitMethod === 'percentage'" @click="splitMethod = 'percentage'">
          Percentage
        </f7-button>
        <f7-button :active="splitMethod === 'custom'" @click="splitMethod = 'custom'">Custom</f7-button>
      </f7-segmented>
      <p class="mt-3 mb-0 text-sm opacity-60">{{ splitHint }}</p>
    </f7-block>

    <f7-block>
      <f7-button large fill round preloader :loading="creating" :disabled="name.trim().length < 2" @click="submit">
        Create group
      </f7-button>
      <p v-if="errorText" class="mt-3 mb-0 text-center text-sm text-red-500">{{ errorText }}</p>
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { f7 } from 'framework7-vue'
import { apiErrorMessage } from '@/services/api'
import { useGroupsStore } from '@/stores/groups'
import type { SplitMethod } from '@/types'

const groupsStore = useGroupsStore()

const name = ref('')
const description = ref('')
const splitMethod = ref<SplitMethod>('equal')
const creating = ref(false)
const errorText = ref<string | null>(null)

const splitHints: Record<SplitMethod, string> = {
  equal: 'Every expense is divided equally between selected members.',
  percentage: 'Each member pays a fixed percentage of every expense.',
  custom: 'You enter exact amounts per member for each expense.',
}
const splitHint = computed(() => splitHints[splitMethod.value])

async function submit() {
  creating.value = true
  errorText.value = null
  try {
    const group = await groupsStore.createGroup({
      name: name.value.trim(),
      description: description.value.trim() || undefined,
      splitMethod: splitMethod.value,
    })
    f7.toast.create({ text: `Group "${group.name}" created`, position: 'center', closeTimeout: 2000 }).open()
    f7.views.main.router.navigate(`/groups/${group.id}/`, { clearPreviousHistory: true })
  } catch (e) {
    errorText.value = apiErrorMessage(e)
  } finally {
    creating.value = false
  }
}
</script>
