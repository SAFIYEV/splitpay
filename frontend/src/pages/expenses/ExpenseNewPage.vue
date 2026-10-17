<template>
  <f7-page>
    <f7-page-content class="pb-10">
      <!-- Sheet header -->
      <div class="relative flex items-center justify-center px-5 pt-6 pb-2">
        <h1 class="m-0 text-lg font-bold">{{ titles[mode] }}</h1>
        <button type="button" class="sp-close-x absolute right-5" @click="close">
          <f7-icon f7="xmark" size="15" />
        </button>
      </div>

      <!-- Mode switcher -->
      <div class="mt-2 grid grid-cols-3 gap-3 px-6">
        <button
          v-for="m in modes"
          :key="m.id"
          type="button"
          class="sp-mode-btn sp-card-sm flex flex-col items-center gap-2 border-2 py-4"
          :style="mode === m.id ? `border-color: ${m.color}` : 'border-color: transparent'"
          @click="mode = m.id"
        >
          <span
            class="flex h-9 w-9 items-center justify-center rounded-full"
            :style="{ backgroundColor: `${m.color}1a`, color: m.color }"
          >
            <f7-icon :f7="m.icon" size="18" />
          </span>
          <span class="sp-mode-btn-label text-[13px] font-semibold" :style="{ color: mode === m.id ? m.color : 'var(--color-sub)' }">
            {{ m.label }}
          </span>
        </button>
      </div>

      <div class="mt-6 px-6">
        <!-- ======== РАСХОД ======== -->
        <template v-if="mode === 'expense'">
          <label class="sp-label">Описание</label>
          <input v-model="description" type="text" class="sp-input mb-4" placeholder="Ужин в ресторане" />

          <label class="sp-label">Сумма</label>
          <div class="sp-input mb-4 flex items-center">
            <input
              v-model="amountText"
              type="number"
              inputmode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              class="sp-amount-input min-w-0 flex-1 border-0 bg-transparent text-2xl font-semibold outline-none"
            />
            <UsdcChip />
          </div>

          <label class="sp-label">Кто оплатил</label>
          <div class="sp-card-sm mb-4 flex items-center gap-3 p-4">
            <UserAvatar :name="auth.user?.displayName ?? 'Вы'" :size="36" />
            <span class="flex-1 font-semibold">{{ auth.user?.displayName ?? 'Вы' }}</span>
            <span class="text-xs" style="color: var(--color-sub)">вы платите</span>
          </div>

          <label class="sp-label">Разделить между</label>
          <button type="button" class="sp-card-sm mb-4 flex w-full items-center gap-3 border-0 p-4 text-left" @click="membersPopupOpen = true">
            <f7-icon f7="person_2_fill" size="18" style="color: var(--color-accent)" />
            <span class="flex-1 font-semibold">{{ splitSummary }}</span>
            <f7-icon f7="chevron_down" size="14" style="color: var(--color-sub)" />
          </button>

          <label class="sp-label">Категория</label>
          <button type="button" class="sp-card-sm mb-4 flex w-full items-center gap-3 border-0 p-4 text-left" @click="categoryPopupOpen = true">
            <span
              class="flex h-8 w-8 items-center justify-center rounded-xl"
              :style="{ backgroundColor: `${categoryMeta(category).color}1a`, color: categoryMeta(category).color }"
            >
              <f7-icon :f7="categoryMeta(category).f7Icon" size="16" />
            </span>
            <span class="flex-1 font-semibold">{{ categoryMeta(category).labelRu }}</span>
            <f7-icon f7="chevron_down" size="14" style="color: var(--color-sub)" />
          </button>

          <label class="sp-label">Дата</label>
          <div class="sp-card-sm mb-6 flex items-center gap-3 p-4">
            <f7-icon f7="calendar" size="18" style="color: var(--color-accent)" />
            <input v-model="date" type="date" class="min-w-0 flex-1 border-0 bg-transparent font-semibold outline-none" />
          </div>

          <button type="button" class="sp-btn-gradient" :disabled="!canSubmitExpense" @click="submitExpense">
            {{ saving ? 'Сохраняем…' : editingExpense ? 'Сохранить изменения' : 'Добавить расход' }}
          </button>
        </template>

        <!-- ======== ДОХОД (получен возврат долга) ======== -->
        <template v-else-if="mode === 'income'">
          <label class="sp-label">От кого</label>
          <button type="button" class="sp-card-sm mb-4 flex w-full items-center gap-3 border-0 p-4 text-left" @click="payerPopupOpen = true">
            <UserAvatar v-if="fromUserId" :name="displayName(fromUserId)" :size="36" />
            <span v-else class="flex h-9 w-9 items-center justify-center rounded-full" style="background: var(--color-accent-soft); color: var(--color-accent)">
              <f7-icon f7="person_fill" size="16" />
            </span>
            <span class="flex-1 font-semibold">{{ fromUserId ? displayName(fromUserId) : 'Выберите участника' }}</span>
            <f7-icon f7="chevron_down" size="14" style="color: var(--color-sub)" />
          </button>

          <label class="sp-label">Сумма</label>
          <div class="sp-input mb-4 flex items-center">
            <input
              v-model="amountText"
              type="number"
              inputmode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              class="sp-amount-input min-w-0 flex-1 border-0 bg-transparent text-2xl font-semibold outline-none"
            />
            <UsdcChip />
          </div>

          <label class="sp-label">Описание (необязательно)</label>
          <input v-model="description" type="text" class="sp-input mb-4" placeholder="Вернули за билеты" />

          <label class="sp-label">Дата</label>
          <div class="sp-card-sm mb-6 flex items-center gap-3 p-4">
            <f7-icon f7="calendar" size="18" style="color: var(--color-accent)" />
            <input v-model="date" type="date" class="min-w-0 flex-1 border-0 bg-transparent font-semibold outline-none" />
          </div>

          <button type="button" class="sp-btn-gradient" :disabled="!canSubmitIncome" @click="submitIncome">
            {{ saving ? 'Сохраняем…' : 'Добавить доход' }}
          </button>
        </template>

        <!-- ======== ПЕРЕВОД ======== -->
        <template v-else>
          <label class="sp-label">От кого</label>
          <div class="sp-card-sm mb-4 flex items-center gap-3 p-4">
            <UserAvatar :name="auth.user?.displayName ?? 'Вы'" :size="36" />
            <span class="flex-1 font-semibold">{{ auth.user?.displayName ?? 'Вы' }}</span>
            <span class="text-xs" style="color: var(--color-sub)">вы платите</span>
          </div>

          <label class="sp-label">Кому</label>
          <button type="button" class="sp-card-sm mb-4 flex w-full items-center gap-3 border-0 p-4 text-left" @click="payerPopupOpen = true">
            <UserAvatar v-if="toUserId" :name="displayName(toUserId)" :size="36" />
            <span v-else class="flex h-9 w-9 items-center justify-center rounded-full" style="background: var(--color-accent-soft); color: var(--color-accent)">
              <f7-icon f7="person_fill" size="16" />
            </span>
            <span class="flex-1 font-semibold">{{ toUserId ? displayName(toUserId) : 'Выберите участника' }}</span>
            <f7-icon f7="chevron_down" size="14" style="color: var(--color-sub)" />
          </button>

          <label class="sp-label">Сумма</label>
          <div class="sp-input mb-4 flex items-center">
            <input
              v-model="amountText"
              type="number"
              inputmode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              class="sp-amount-input min-w-0 flex-1 border-0 bg-transparent text-2xl font-semibold outline-none"
            />
            <UsdcChip />
          </div>

          <label class="sp-label">Описание (необязательно)</label>
          <input v-model="description" type="text" class="sp-input mb-4" placeholder="За что перевод" />

          <label class="sp-label">Сеть</label>
          <div class="sp-card-sm mb-6 flex items-center gap-3 p-4">
            <span class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style="background: linear-gradient(135deg, #9945ff, #14f195)">◎</span>
            <span class="flex-1 font-semibold">Solana</span>
            <span class="text-xs" style="color: var(--color-sub)">devnet</span>
          </div>

          <button type="button" class="sp-btn-gradient" :disabled="!canSubmitTransfer" @click="submitTransfer">
            {{ saving ? 'Создаём…' : 'Перевести' }}
          </button>
        </template>

        <p v-if="errorText" class="mt-3 mb-0 text-center text-sm" style="color: var(--color-rose)">{{ errorText }}</p>
      </div>

      <!-- Member multi-select (split) -->
      <f7-popup v-model:opened="membersPopupOpen" class="sp-popup">
        <div class="px-6 pt-5 pb-8" style="background: var(--color-lav); border-radius: 28px 28px 0 0">
          <h3 class="m-0 mb-4 text-center text-lg font-bold">Разделить между</h3>
          <button
            v-for="member in members"
            :key="member.userId"
            type="button"
            class="sp-card-sm mb-2.5 flex w-full items-center gap-3 border-0 p-4 text-left"
            @click="toggleMember(member.userId)"
          >
            <UserAvatar :name="displayName(member.userId)" :size="36" />
            <span class="flex-1 font-semibold">{{ displayName(member.userId) }}</span>
            <span
              class="flex h-6 w-6 items-center justify-center rounded-full border-2"
              :style="selected.has(member.userId) ? 'background: var(--color-accent); border-color: var(--color-accent)' : 'border-color: #cfcde0'"
            >
              <f7-icon v-if="selected.has(member.userId)" f7="checkmark" size="12" color="white" />
            </span>
          </button>
          <button type="button" class="sp-btn-gradient mt-4" @click="membersPopupOpen = false">Готово</button>
        </div>
      </f7-popup>

      <!-- Single member picker (От кого / Кому) -->
      <f7-popup v-model:opened="payerPopupOpen" class="sp-popup">
        <div class="px-6 pt-5 pb-8" style="background: var(--color-lav); border-radius: 28px 28px 0 0">
          <h3 class="m-0 mb-4 text-center text-lg font-bold">Выберите участника</h3>
          <button
            v-for="member in otherMembers"
            :key="member.userId"
            type="button"
            class="sp-card-sm mb-2.5 flex w-full items-center gap-3 border-0 p-4 text-left"
            @click="pickMember(member.userId)"
          >
            <UserAvatar :name="displayName(member.userId)" :size="36" />
            <span class="flex-1 font-semibold">{{ displayName(member.userId) }}</span>
          </button>
        </div>
      </f7-popup>

      <!-- Category picker -->
      <f7-popup v-model:opened="categoryPopupOpen" class="sp-popup">
        <div class="px-6 pt-5 pb-8" style="background: var(--color-lav); border-radius: 28px 28px 0 0">
          <h3 class="m-0 mb-4 text-center text-lg font-bold">Категория</h3>
          <button
            v-for="cat in CATEGORIES"
            :key="cat.id"
            type="button"
            class="sp-card-sm mb-2.5 flex w-full items-center gap-3 border-0 p-4 text-left"
            @click="category = cat.id; categoryPopupOpen = false"
          >
            <span class="flex h-9 w-9 items-center justify-center rounded-xl" :style="{ backgroundColor: `${cat.color}1a`, color: cat.color }">
              <f7-icon :f7="cat.f7Icon" size="18" />
            </span>
            <span class="flex-1 font-semibold">{{ cat.labelRu }}</span>
            <f7-icon v-if="category === cat.id" f7="checkmark" size="16" style="color: var(--color-accent)" />
          </button>
        </div>
      </f7-popup>
    </f7-page-content>
  </f7-page>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { f7 } from 'framework7-vue'
import type { Router } from 'framework7/types'
import UserAvatar from '@/components/common/UserAvatar.vue'
import UsdcChip from '@/components/common/UsdcChip.vue'
import { CATEGORIES, categoryMeta } from '@/composables/categories'
import { apiErrorMessage } from '@/services/api'
import { splitEqually } from '@/services/utils/split-calculator'
import { useAuthStore } from '@/stores/auth'
import { useExpensesStore } from '@/stores/expenses'
import { useGroupsStore } from '@/stores/groups'
import { useSettlementsStore } from '@/stores/settlements'
import type { ExpenseCategory } from '@/types'

const props = defineProps<{
  f7route: { params: { id: string }; query: { edit?: string } }
  f7router: Router.Router
}>()

const auth = useAuthStore()
const groupsStore = useGroupsStore()
const expensesStore = useExpensesStore()
const settlementsStore = useSettlementsStore()

const groupId = props.f7route.params.id
const editId = props.f7route.query.edit

type Mode = 'expense' | 'income' | 'transfer'
const mode = ref<Mode>('expense')
const modes: { id: Mode; label: string; icon: string; color: string }[] = [
  { id: 'expense', label: 'Расход', icon: 'creditcard_fill', color: '#6d5be2' },
  { id: 'income', label: 'Доход', icon: 'plus', color: '#34c77b' },
  { id: 'transfer', label: 'Перевод', icon: 'arrow_right_arrow_left', color: '#2f7fc4' },
]
const titles: Record<Mode, string> = {
  expense: editId ? 'Изменить расход' : 'Добавить расход',
  income: 'Добавить доход',
  transfer: 'Перевести',
}

const description = ref('')
const amountText = ref('')
const date = ref(new Date().toISOString().slice(0, 10))
const category = ref<ExpenseCategory>('other')
const selected = reactive(new Set<string>())
const fromUserId = ref('')
const toUserId = ref('')
const saving = ref(false)
const errorText = ref<string | null>(null)
const membersPopupOpen = ref(false)
const payerPopupOpen = ref(false)
const categoryPopupOpen = ref(false)

const editingExpense = computed(() =>
  editId ? expensesStore.expensesFor(groupId).find((e) => e.id === editId) ?? null : null,
)

const group = computed(() =>
  groupsStore.currentGroup?.id === groupId ? groupsStore.currentGroup : null,
)
const members = computed(() => group.value?.members ?? [])
const otherMembers = computed(() =>
  members.value.filter((m) => m.userId !== auth.user?.id),
)

const amount = computed(() => {
  const value = parseFloat(amountText.value)
  return Number.isFinite(value) && value > 0 ? value : 0
})

const splitSummary = computed(() =>
  selected.size === members.value.length
    ? 'Все участники'
    : `${selected.size} из ${members.value.length}`,
)

const canSubmitExpense = computed(
  () => description.value.trim().length > 0 && amount.value > 0 && selected.size > 0 && !saving.value,
)
const canSubmitIncome = computed(() => !!fromUserId.value && amount.value > 0 && !saving.value)
const canSubmitTransfer = computed(() => !!toUserId.value && amount.value > 0 && !saving.value)

function displayName(userId: string) {
  return groupsStore.memberName(group.value, userId)
}

function toggleMember(userId: string) {
  if (selected.has(userId)) selected.delete(userId)
  else selected.add(userId)
}

function pickMember(userId: string) {
  if (mode.value === 'income') fromUserId.value = userId
  else toUserId.value = userId
  payerPopupOpen.value = false
}

function close() {
  props.f7router.back()
}

async function submitExpense() {
  saving.value = true
  errorText.value = null
  const draft = {
    description: description.value.trim(),
    amount: amount.value,
    category: category.value,
    date: new Date(date.value).toISOString(),
    splits: splitEqually(amount.value, [...selected]),
  }
  try {
    if (editingExpense.value) {
      await expensesStore.updateExpense(groupId, editingExpense.value.id, draft)
    } else {
      await expensesStore.createExpense(groupId, draft)
    }
    f7.toast.create({ text: editingExpense.value ? 'Расход обновлён' : 'Расход добавлен', position: 'center', closeTimeout: 1500 }).open()
    props.f7router.back()
  } catch (e) {
    errorText.value = apiErrorMessage(e)
  } finally {
    saving.value = false
  }
}

/** Доход: участник вернул мне долг — settlement от него ко мне; завершается
 *  после подтверждения плательщиком (контрагент подтверждает запись). */
async function submitIncome() {
  saving.value = true
  errorText.value = null
  try {
    await settlementsStore.createSettlement(groupId, {
      fromUserId: fromUserId.value,
      toUserId: auth.user!.id,
      amount: amount.value,
      notes: description.value.trim() || 'Возврат долга',
    })
    await settlementsStore.fetchBalance(groupId).catch(() => {})
    f7.toast
      .create({ text: 'Записано — плательщик подтвердит оплату', position: 'center', closeTimeout: 2000 })
      .open()
    props.f7router.back()
  } catch (e) {
    errorText.value = apiErrorMessage(e)
  } finally {
    saving.value = false
  }
}

/** Перевод: переходим к экрану оплаты с предзаполненными получателем и суммой;
 *  сам settlement создаётся там при оплате (on-chain или вручную).
 *  NOTE: query передаётся через объектную форму navigate — во втором аргументе
 *  (RouteOptions) query нет и он молча теряется. */
function submitTransfer() {
  props.f7router.navigate({
    path: `/groups/${groupId}/settle/`,
    query: { to: toUserId.value, amount: amountText.value },
  })
}

onMounted(async () => {
  if (!group.value) await groupsStore.fetchGroup(groupId).catch(() => {})

  if (editingExpense.value) {
    const expense = editingExpense.value
    description.value = expense.description
    amountText.value = String(expense.amount)
    date.value = expense.date.slice(0, 10)
    category.value = expense.category
    for (const split of expense.splits) selected.add(split.userId)
  } else {
    for (const member of members.value) selected.add(member.userId)
  }
})
</script>

<style>
.sp-popup {
  border-radius: 28px 28px 0 0;
  top: auto;
  height: auto;
  max-height: 75%;
  background: var(--color-lav);
}
</style>
