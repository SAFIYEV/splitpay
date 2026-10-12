<template>
  <div class="absolute right-0 bottom-0 left-0 z-30 px-5 pb-5">
    <div
      class="flex items-center justify-between rounded-[24px] bg-white px-6 py-3"
      style="box-shadow: 0 12px 32px rgba(109, 91, 226, 0.12)"
    >
      <button type="button" class="sp-tab" :class="{ 'sp-tab-active': active === 'home' }" @click="go('/groups/')">
        <f7-icon f7="house_fill" size="22" />
        <span>Главная</span>
      </button>
      <button type="button" class="sp-tab" :class="{ 'sp-tab-active': active === 'activity' }" @click="go('/activity/')">
        <f7-icon f7="bolt_fill" size="22" />
        <span>Активность</span>
      </button>
      <button type="button" class="sp-tab-plus" aria-label="Добавить" @click="add">
        <f7-icon f7="plus" size="26" color="white" />
      </button>
      <button type="button" class="sp-tab" :class="{ 'sp-tab-active': active === 'settle' }" @click="goSettle">
        <f7-icon f7="arrow_right_arrow_left" size="22" />
        <span>Расчёты</span>
      </button>
      <button type="button" class="sp-tab" :class="{ 'sp-tab-active': active === 'profile' }" @click="go('/profile/')">
        <f7-icon f7="person_fill" size="22" />
        <span>Профиль</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { f7 } from 'framework7-vue'
import { useGroupsStore } from '@/stores/groups'

const props = withDefaults(defineProps<{ active?: string; groupId?: string }>(), {
  active: '',
  groupId: '',
})

const groupsStore = useGroupsStore()

/** Group context for + and Расчёты: explicit prop, else the first active group. */
const contextGroupId = computed(() => props.groupId || groupsStore.activeGroups[0]?.id || '')

function go(url: string) {
  f7.views.main.router.navigate(url)
}

function add() {
  if (contextGroupId.value) go(`/groups/${contextGroupId.value}/expenses/new/`)
  else go('/groups/new/')
}

function goSettle() {
  if (contextGroupId.value) go(`/groups/${contextGroupId.value}/balances/`)
  else f7.toast.create({ text: 'Сначала создайте группу', position: 'center', closeTimeout: 1800 }).open()
}
</script>

<style scoped>
.sp-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  background: none;
  border: none;
  color: var(--color-sub);
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
  padding: 2px 0;
}
.sp-tab-active {
  color: var(--color-accent);
}
.sp-tab-plus {
  width: 52px;
  height: 52px;
  margin-top: -26px;
  border-radius: 9999px;
  background: linear-gradient(135deg, #7c6cf0 0%, #9d7bfa 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 4px solid #fff;
  box-shadow: 0 10px 22px rgba(124, 108, 240, 0.45);
  cursor: pointer;
}
.sp-tab-plus:active {
  transform: scale(0.95);
}
</style>
