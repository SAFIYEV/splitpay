<template>
  <f7-page>
    <f7-page-content class="pb-10">
      <div class="relative flex items-center justify-center px-5 pt-6 pb-2">
        <h1 class="m-0 text-lg font-bold">Создать группу</h1>
        <button type="button" class="sp-close-x absolute right-5" @click="close">
          <f7-icon f7="xmark" size="15" />
        </button>
      </div>

      <!-- Emoji / photo picker -->
      <div class="mt-4 flex justify-center">
        <button
          type="button"
          class="flex h-24 w-24 items-center justify-center rounded-full border-0 text-4xl"
          style="background: var(--color-accent-soft)"
          @click="cycleEmoji"
        >
          {{ emoji || '' }}
          <f7-icon v-if="!emoji" f7="person_3_fill" size="36" style="color: var(--color-accent)" />
        </button>
      </div>
      <p class="mt-2 text-center text-xs" style="color: var(--color-sub)">Нажмите, чтобы сменить значок</p>

      <div class="mt-6 px-6">
        <label class="sp-label">Название группы</label>
        <input v-model="name" type="text" class="sp-input mb-6" placeholder="Например, Поездка в Европу" />

        <label class="sp-label">Добавить участников</label>
        <input
          v-model="search"
          type="text"
          class="sp-input mb-3"
          placeholder="Поиск по имени или email"
        />

        <div v-if="searching" class="py-3 text-center text-sm" style="color: var(--color-sub)">Ищем…</div>
        <template v-else-if="searchResults.length > 0">
          <div
            v-for="user in searchResults"
            :key="user.id"
            class="sp-card-sm mb-2.5 flex items-center gap-3 p-4"
          >
            <UserAvatar :name="user.displayName" :src="user.avatar" :size="40" />
            <div class="min-w-0 flex-1">
              <p class="m-0 truncate font-semibold">{{ user.displayName }}</p>
              <p v-if="user.email" class="m-0 truncate text-xs" style="color: var(--color-sub)">{{ user.email }}</p>
            </div>
            <button
              type="button"
              class="flex h-9 w-9 items-center justify-center rounded-full border-0"
              :style="picked.has(user.id)
                ? 'background: var(--color-mint); color: #fff'
                : 'background: var(--color-accent-soft); color: var(--color-accent)'"
              @click="togglePick(user)"
            >
              <f7-icon :f7="picked.has(user.id) ? 'checkmark' : 'plus'" size="16" />
            </button>
          </div>
        </template>
        <p v-else-if="search.trim()" class="py-3 text-center text-sm" style="color: var(--color-sub)">
          Никого не нашли
        </p>

        <p v-if="picked.size > 0" class="mb-4 text-xs" style="color: var(--color-sub)">
          Выбрано: {{ picked.size }}. Участники вступают по коду приглашения — мы покажем его после создания группы.
        </p>

        <button type="button" class="sp-btn-gradient" :disabled="name.trim().length < 2 || creating" @click="submit">
          {{ creating ? 'Создаём…' : 'Создать группу' }}
        </button>
        <p v-if="errorText" class="mt-3 mb-0 text-center text-sm" style="color: var(--color-rose)">{{ errorText }}</p>
      </div>
    </f7-page-content>
  </f7-page>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { f7 } from 'framework7-vue'
import type { Router } from 'framework7/types'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { api, apiErrorMessage } from '@/services/api'
import { useGroupsStore } from '@/stores/groups'
import type { User } from '@/types'

const props = defineProps<{ f7router: Router.Router }>()

const groupsStore = useGroupsStore()

const EMOJIS = ['🌴', '✈️', '🏠', '🍕', '🎉', '🚗', '🏖️', '🎿', '🎫', '💼']

const name = ref('')
const emoji = ref('🌴')
const search = ref('')
const searchResults = ref<User[]>([])
const searching = ref(false)
const picked = reactive(new Map<string, User>())
const creating = ref(false)
const errorText = ref<string | null>(null)

let searchTimer: ReturnType<typeof setTimeout> | null = null

watch(search, (q) => {
  if (searchTimer) clearTimeout(searchTimer)
  const query = q.trim()
  if (!query) {
    searchResults.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    searching.value = true
    try {
      const { data } = await api.get<User[]>('/users/search', { params: { q: query } })
      searchResults.value = data
    } catch {
      searchResults.value = []
    } finally {
      searching.value = false
    }
  }, 350)
})

function cycleEmoji() {
  const idx = EMOJIS.indexOf(emoji.value)
  emoji.value = EMOJIS[(idx + 1) % EMOJIS.length]!
}

function togglePick(user: User) {
  if (picked.has(user.id)) picked.delete(user.id)
  else picked.set(user.id, user)
}

function close() {
  props.f7router.back()
}

async function submit() {
  creating.value = true
  errorText.value = null
  try {
    const fullName = `${name.value.trim()} ${emoji.value}`
    const group = await groupsStore.createGroup({ name: fullName })
    f7.toast.create({ text: `Группа «${fullName}» создана`, position: 'center', closeTimeout: 2000 }).open()
    if (picked.size > 0 && group.inviteCode) {
      f7.dialog.alert(
        `Отправьте участникам код приглашения: ${group.inviteCode}`,
        'Группа создана',
        () => props.f7router.navigate(`/groups/${group.id}/`, { clearPreviousHistory: true }),
      )
    } else {
      props.f7router.navigate(`/groups/${group.id}/`, { clearPreviousHistory: true })
    }
  } catch (e) {
    errorText.value = apiErrorMessage(e)
  } finally {
    creating.value = false
  }
}
</script>
