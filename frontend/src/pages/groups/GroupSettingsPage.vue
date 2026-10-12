<template>
  <f7-page>
    <f7-page-content class="pb-10">
      <div class="flex items-center gap-3 px-5 pt-6 pb-4">
        <button type="button" class="sp-icon-btn" @click="back">
          <f7-icon f7="chevron_left" size="20" />
        </button>
        <h1 class="m-0 text-lg font-bold">Настройки группы</h1>
      </div>

      <template v-if="group">
        <div class="px-6">
          <label class="sp-label">Название группы</label>
          <input v-model="name" type="text" class="sp-input mb-4" />

          <label class="sp-label">Описание</label>
          <textarea v-model="description" class="sp-input mb-4" rows="2" placeholder="Зачем эта группа?" />

          <button type="button" class="sp-btn-gradient" :disabled="!dirty || saving" @click="save">
            {{ saving ? 'Сохраняем…' : 'Сохранить' }}
          </button>
          <p v-if="errorText" class="mt-3 mb-0 text-center text-sm" style="color: var(--color-rose)">{{ errorText }}</p>
        </div>

        <div class="mt-6 px-6">
          <p class="sp-label">Приглашение</p>
          <div class="sp-card-sm flex items-center gap-3 p-4">
            <div class="min-w-0 flex-1">
              <p class="m-0 text-xs" style="color: var(--color-sub)">Код приглашения</p>
              <p class="m-0 text-lg font-bold tracking-widest">{{ group.inviteCode ?? '—' }}</p>
            </div>
            <button type="button" class="rounded-full border-0 px-4 py-2 text-sm font-semibold" style="background: var(--color-accent-soft); color: var(--color-accent)" @click="copyInvite">
              Копировать
            </button>
          </div>
          <button type="button" class="sp-btn-soft mt-3" @click="regenerate">Сгенерировать новый код</button>
          <button type="button" class="sp-btn-soft mt-3" @click="go(`/groups/${groupId}/members/`)">
            Участники ({{ group.members.length }})
          </button>
        </div>

        <template v-if="isAdmin">
          <div class="mt-6 px-6">
            <p class="sp-label">Опасная зона</p>
            <button v-if="group.status === 'active'" type="button" class="sp-btn-soft" @click="archive">
              Архивировать группу
            </button>
            <button
              type="button"
              class="mt-3 w-full rounded-[18px] border-0 py-4 text-[16px] font-semibold"
              style="background: #ffeef3; color: var(--color-rose)"
              @click="confirmDelete"
            >
              Удалить группу
            </button>
          </div>
        </template>

        <div class="mt-4 px-6">
          <button
            type="button"
            class="w-full rounded-[18px] border-2 bg-transparent py-3.5 text-[15px] font-semibold"
            style="border-color: #ffd3e0; color: var(--color-rose)"
            @click="confirmLeave"
          >
            Покинуть группу
          </button>
        </div>
      </template>

      <div v-else class="flex justify-center py-20">
        <f7-preloader />
      </div>
    </f7-page-content>
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
  () => group.value?.members.some((m) => m.userId === auth.user?.id && m.role === 'admin') ?? false,
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

function go(url: string) {
  f7.views.main.router.navigate(url)
}

function back() {
  props.f7router.back()
}

async function save() {
  saving.value = true
  errorText.value = null
  try {
    await groupsStore.updateGroup(groupId, { name: name.value.trim(), description: description.value.trim() })
    f7.toast.create({ text: 'Группа обновлена', position: 'center', closeTimeout: 1500 }).open()
  } catch (e) {
    errorText.value = apiErrorMessage(e)
  } finally {
    saving.value = false
  }
}

async function copyInvite() {
  const code = group.value?.inviteCode
  if (!code) return
  try {
    await navigator.clipboard.writeText(code)
    f7.toast.create({ text: 'Код скопирован', position: 'center', closeTimeout: 1500 }).open()
  } catch {
    f7.dialog.alert(code, 'Код приглашения')
  }
}

async function regenerate() {
  try {
    const code = await groupsStore.regenerateInvite(groupId)
    f7.toast.create({ text: code ? `Новый код: ${code}` : 'Код обновлён', position: 'center', closeTimeout: 2500 }).open()
  } catch (e) {
    f7.dialog.alert(apiErrorMessage(e), 'Не удалось создать код')
  }
}

async function archive() {
  try {
    await groupsStore.updateGroup(groupId, { status: 'archived' })
    f7.toast.create({ text: 'Группа архивирована', position: 'center', closeTimeout: 1500 }).open()
    go('/groups/')
  } catch (e) {
    f7.dialog.alert(apiErrorMessage(e), 'Не удалось архивировать')
  }
}

function confirmDelete() {
  f7.dialog.confirm('Удалить группу и все расходы? Это действие нельзя отменить.', 'Удалить группу', async () => {
    try {
      await groupsStore.deleteGroup(groupId)
      go('/groups/')
    } catch (e) {
      f7.dialog.alert(apiErrorMessage(e), 'Не удалось удалить')
    }
  })
}

function confirmLeave() {
  f7.dialog.confirm('Покинуть группу? Ваши расходы останутся видны участникам.', 'Покинуть группу', async () => {
    try {
      await groupsStore.leaveGroup(groupId)
      go('/groups/')
    } catch (e) {
      f7.dialog.alert(apiErrorMessage(e), 'Не удалось выйти')
    }
  })
}

onMounted(() => {
  if (!group.value) void groupsStore.fetchGroup(groupId).catch(() => {})
})
</script>
