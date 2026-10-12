<template>
  <f7-page ptr @ptr:refresh="refresh">
    <f7-page-content class="pb-10">
      <div class="flex items-center gap-3 px-5 pt-6 pb-4">
        <button type="button" class="sp-icon-btn" @click="go(`/groups/${groupId}/`)">
          <f7-icon f7="chevron_left" size="20" />
        </button>
        <h1 class="m-0 text-lg font-bold">Участники</h1>
      </div>

      <div v-if="group?.inviteCode" class="px-6">
        <div class="sp-card-sm flex items-center gap-3 p-4">
          <div class="min-w-0 flex-1">
            <p class="m-0 text-xs" style="color: var(--color-sub)">Код приглашения</p>
            <p class="m-0 text-lg font-bold tracking-widest">{{ group.inviteCode }}</p>
          </div>
          <button type="button" class="rounded-full border-0 px-4 py-2 text-sm font-semibold" style="background: var(--color-accent-soft); color: var(--color-accent)" @click="copyInvite">
            Копировать
          </button>
          <button v-if="canShare" type="button" class="rounded-full border-0 px-4 py-2 text-sm font-semibold text-white" style="background: linear-gradient(135deg, #7c6cf0, #9d7bfa)" @click="shareInvite">
            Поделиться
          </button>
        </div>
      </div>

      <div class="mt-5 px-6">
        <p class="sp-label">{{ group?.members.length ?? 0 }} участников</p>
        <div
          v-for="member in group?.members ?? []"
          :key="member.userId"
          class="sp-card-sm mb-2.5 flex items-center gap-3 p-4"
        >
          <UserAvatar :name="displayName(member.userId)" :size="42" />
          <div class="min-w-0 flex-1">
            <p class="m-0 truncate font-semibold">
              {{ displayName(member.userId) }}
              <span v-if="member.userId === auth.user?.id" class="text-xs font-normal" style="color: var(--color-sub)">— вы</span>
            </p>
            <p class="m-0 text-xs" style="color: var(--color-sub)">
              {{ member.role === 'admin' ? 'Администратор' : 'Участник' }}
            </p>
          </div>
          <button
            v-if="canRemove(member.userId)"
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-full border-0"
            style="background: #ffeef3; color: var(--color-rose)"
            @click="confirmRemove(member.userId)"
          >
            <f7-icon f7="xmark" size="13" />
          </button>
        </div>
      </div>
    </f7-page-content>
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
  () => group.value?.members.some((m) => m.userId === auth.user?.id && m.role === 'admin') ?? false,
)
const canShare = computed(() => typeof navigator !== 'undefined' && 'share' in navigator)

function displayName(userId: string) {
  return groupsStore.memberName(group.value, userId)
}

function canRemove(userId: string) {
  return isAdmin.value && userId !== auth.user?.id
}

function go(url: string) {
  f7.views.main.router.navigate(url)
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

async function shareInvite() {
  const code = group.value?.inviteCode
  if (!code) return
  try {
    await navigator.share({
      title: `Вступай в ${group.value?.name} на SplitPay`,
      text: `Присоединяйся к моей группе «${group.value?.name}» в SplitPay. Код приглашения: ${code}`,
    })
  } catch {
    // User cancelled the share sheet.
  }
}

function confirmRemove(userId: string) {
  f7.dialog.confirm(`Удалить ${displayName(userId)} из группы?`, 'Удалить участника', async () => {
    try {
      await groupsStore.removeMember(groupId, userId)
      f7.toast.create({ text: 'Участник удалён', position: 'center', closeTimeout: 1500 }).open()
    } catch (e) {
      f7.dialog.alert(apiErrorMessage(e), 'Не удалось удалить участника')
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
