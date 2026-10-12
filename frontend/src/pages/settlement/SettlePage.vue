<template>
  <f7-page>
    <!-- ======== Success state ======== -->
    <f7-page-content v-if="success" class="relative overflow-hidden">
      <div class="sp-blob" style="width: 260px; height: 260px; background: #d3f5e5; top: 10%; left: -60px" />
      <div class="sp-blob" style="width: 220px; height: 220px; background: #d9d0ff; bottom: 5%; right: -60px" />

      <div class="relative z-10 flex min-h-full flex-col items-center justify-center px-8 text-center">
        <div
          class="mb-6 flex h-28 w-28 items-center justify-center rounded-full"
          style="background: #e5f9ef; box-shadow: 0 0 0 18px rgba(52,199,123,0.12), 0 0 0 36px rgba(52,199,123,0.06)"
        >
          <div class="flex h-20 w-20 items-center justify-center rounded-full" style="background: var(--color-mint)">
            <f7-icon f7="checkmark" size="40" color="white" />
          </div>
        </div>

        <h1 class="m-0 text-2xl font-bold">Платёж отправлен!</h1>
        <p class="sp-positive m-0 mt-3 text-3xl font-bold">{{ formatUsdc(success.amount) }}</p>
        <p class="mt-2 mb-8 text-[15px]" style="color: var(--color-sub)">
          {{ success.toName }} получит ваш платёж
        </p>

        <a
          v-if="success.signature"
          class="sp-btn-soft mb-3 flex items-center justify-center gap-2 no-underline"
          :href="`https://explorer.solana.com/tx/${success.signature}?cluster=${network}`"
          target="_blank"
          rel="noopener"
        >
          Просмотреть в Solscan
          <f7-icon f7="arrow_up_right" size="14" />
        </a>
        <button type="button" class="sp-btn-gradient" @click="done">Готово</button>
      </div>
    </f7-page-content>

    <!-- ======== Payment form ======== -->
    <f7-page-content v-else class="pb-10">
      <div class="flex items-center justify-between px-5 pt-6 pb-2">
        <button type="button" class="sp-icon-btn" @click="back">
          <f7-icon f7="chevron_left" size="20" />
        </button>
        <h1 class="m-0 text-lg font-bold">Оплатить долг</h1>
        <div class="w-10" />
      </div>

      <div class="mt-4 px-6">
        <!-- Recipient + amount -->
        <div class="sp-card mb-4 p-5">
          <p class="m-0 mb-3 text-[13px] font-medium" style="color: var(--color-sub)">Вы платите</p>
          <button
            type="button"
            class="mb-4 flex w-full items-center gap-3 border-0 bg-transparent p-0 text-left"
            @click="recipientPopupOpen = true"
          >
            <UserAvatar v-if="toUserId" :name="displayName(toUserId)" :size="40" />
            <span v-else class="flex h-10 w-10 items-center justify-center rounded-full" style="background: var(--color-accent-soft); color: var(--color-accent)">
              <f7-icon f7="person_fill" size="18" />
            </span>
            <span class="flex-1 text-[17px] font-semibold">
              {{ toUserId ? displayName(toUserId) : 'Выберите получателя' }}
            </span>
            <f7-icon f7="chevron_down" size="14" style="color: var(--color-sub)" />
          </button>

          <div class="flex items-end justify-between">
            <input
              v-model="amountText"
              type="number"
              inputmode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              class="min-w-0 flex-1 border-0 bg-transparent p-0 text-4xl font-bold outline-none"
            />
            <UsdcChip />
          </div>
          <p class="m-0 mt-1 text-sm" style="color: var(--color-sub)">≈ ${{ amount.toFixed(2) }}</p>
        </div>

        <!-- Network -->
        <div class="sp-card-sm mb-3 flex items-center gap-3 p-4">
          <span class="text-[15px]" style="color: var(--color-sub)">Сеть</span>
          <span class="flex-1" />
          <span class="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white" style="background: linear-gradient(135deg, #9945ff, #14f195)">◎</span>
          <span class="font-semibold">Solana</span>
        </div>

        <!-- Wallet -->
        <div class="sp-card-sm mb-3 flex items-center gap-3 p-4">
          <span class="text-[15px]" style="color: var(--color-sub)">Кошелёк</span>
          <span class="flex-1" />
          <template v-if="wallet.isConnected">
            <span class="text-right">
              <span class="block text-sm font-semibold">{{ wallet.walletName }}</span>
              <span class="block text-xs" style="color: var(--color-sub)">
                {{ truncateAddress(wallet.address ?? '', 6, 6) }} · {{ wallet.solBalance?.toFixed(3) ?? '—' }} SOL
              </span>
            </span>
          </template>
          <button
            v-else
            type="button"
            class="rounded-full border-0 px-4 py-2 text-sm font-semibold"
            style="background: var(--color-accent-soft); color: var(--color-accent)"
            @click="walletSheetOpen = true"
          >
            Подключить
          </button>
        </div>

        <!-- Network fee -->
        <div class="sp-card-sm mb-6 flex items-center gap-3 p-4">
          <span class="text-[15px]" style="color: var(--color-sub)">Комиссия сети</span>
          <span class="flex-1" />
          <span class="text-right">
            <span class="sp-positive block text-sm font-semibold">~0.000005 SOL</span>
            <span class="block text-xs" style="color: var(--color-sub)">≈ $0.00</span>
          </span>
        </div>

        <button
          v-if="wallet.isConnected"
          type="button"
          class="sp-btn-gradient"
          :disabled="!canPay"
          @click="payWithWallet"
        >
          {{ paying ? stepText ?? 'Оплачиваем…' : `Оплатить ${amount > 0 ? formatUsdc(amount) : 'USDC'}` }}
        </button>
        <button v-else type="button" class="sp-btn-gradient" :disabled="!canPay" @click="recordManually">
          {{ paying ? 'Записываем…' : 'Записать оплату' }}
        </button>

        <p v-if="!wallet.isConnected" class="mt-3 mb-0 text-center text-xs" style="color: var(--color-sub)">
          Кошелёк не подключён — платёж будет записан вручную, без on-chain перевода
        </p>
        <p v-if="errorText" class="mt-3 mb-0 text-center text-sm" style="color: var(--color-rose)">{{ errorText }}</p>
      </div>

      <!-- Recipient picker -->
      <f7-popup v-model:opened="recipientPopupOpen" class="sp-popup">
        <div class="px-6 pt-5 pb-8" style="background: var(--color-lav); border-radius: 28px 28px 0 0">
          <h3 class="m-0 mb-4 text-center text-lg font-bold">Кому</h3>
          <button
            v-for="member in otherMembers"
            :key="member.userId"
            type="button"
            class="sp-card-sm mb-2.5 flex w-full items-center gap-3 border-0 p-4 text-left"
            @click="toUserId = member.userId; recipientPopupOpen = false"
          >
            <UserAvatar :name="displayName(member.userId)" :size="36" />
            <span class="flex-1 font-semibold">{{ displayName(member.userId) }}</span>
            <span v-if="owedTo(member.userId) > 0" class="text-xs" style="color: var(--color-sub)">
              вы должны {{ formatUsdc(owedTo(member.userId)) }}
            </span>
          </button>
        </div>
      </f7-popup>

      <!-- Wallet connect sheet -->
      <f7-sheet v-model:opened="walletSheetOpen" style="height: auto; --f7-sheet-border-radius: 28px">
        <div class="px-6 pt-4 pb-8">
          <div class="mx-auto mb-4 h-1 w-10 rounded-full" style="background: #e6e4f2" />
          <h3 class="m-0 mb-4 text-center text-lg font-bold">Подключить кошелёк</h3>
          <template v-if="wallet.wallets.length > 0">
            <button
              v-for="w in wallet.wallets"
              :key="w.name"
              type="button"
              class="sp-card-sm mb-3 flex w-full items-center gap-3 border-0 p-4 text-left"
              :disabled="wallet.connecting"
              @click="connectWallet(w)"
            >
              <img :src="w.icon" :alt="w.name" class="h-10 w-10 rounded-xl" />
              <span class="flex-1 font-semibold">{{ w.name }}</span>
              <f7-icon f7="chevron_right" size="16" style="color: var(--color-sub)" />
            </button>
          </template>
          <p v-else class="my-4 text-center text-sm" style="color: var(--color-sub)">
            Кошелёк не обнаружен. Установите Phantom, Solflare или Backpack.
          </p>
        </div>
      </f7-sheet>
    </f7-page-content>
  </f7-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Router } from 'framework7/types'
import UserAvatar from '@/components/common/UserAvatar.vue'
import UsdcChip from '@/components/common/UsdcChip.vue'
import { apiErrorMessage } from '@/services/api'
import { sendBase64Transaction, SOLANA_NETWORK } from '@/services/solana'
import { formatUsdc, truncateAddress } from '@/services/utils/format'
import type { ConnectableWallet } from '@/services/wallet-adapter'
import { useAuthStore } from '@/stores/auth'
import { useGroupsStore } from '@/stores/groups'
import { useSettlementsStore } from '@/stores/settlements'
import { useWalletStore } from '@/stores/wallet'

const props = defineProps<{
  f7route: { params: { id: string }; query: { to?: string; amount?: string } }
  f7router: Router.Router
}>()

const auth = useAuthStore()
const groupsStore = useGroupsStore()
const settlementsStore = useSettlementsStore()
const wallet = useWalletStore()

const groupId = props.f7route.params.id
const network = SOLANA_NETWORK

const toUserId = ref(props.f7route.query.to ?? '')
const amountText = ref(props.f7route.query.amount ?? '')
const paying = ref(false)
const stepText = ref<string | null>(null)
const errorText = ref<string | null>(null)
const recipientPopupOpen = ref(false)
const walletSheetOpen = ref(false)

const success = ref<{ amount: number; toName: string; signature?: string } | null>(null)

const group = computed(() =>
  groupsStore.currentGroup?.id === groupId ? groupsStore.currentGroup : null,
)
const otherMembers = computed(
  () => group.value?.members.filter((m) => m.userId !== auth.user?.id) ?? [],
)

const amount = computed(() => {
  const value = parseFloat(amountText.value)
  return Number.isFinite(value) && value > 0 ? value : 0
})

const canPay = computed(() => !!toUserId.value && amount.value > 0 && !paying.value)

function displayName(userId: string) {
  return groupsStore.memberName(group.value, userId)
}

function owedTo(userId: string): number {
  const balance = settlementsStore.balanceByGroup[groupId]
  const debt = balance?.debts.find((d) => d.fromUserId === auth.user?.id && d.toUserId === userId)
  return debt?.amount ?? 0
}

function back() {
  props.f7router.back()
}

function done() {
  props.f7router.navigate(`/groups/${groupId}/`, { clearPreviousHistory: true })
}

async function connectWallet(w: ConnectableWallet) {
  try {
    await wallet.connect(w)
    walletSheetOpen.value = false
  } catch {
    // wallet.error is set by the store
  }
}

/** On-chain flow (spec 5.2): create → prepare-tx → sign → broadcast → confirm. */
async function payWithWallet() {
  paying.value = true
  errorText.value = null
  try {
    stepText.value = 'Создаём платёж…'
    const settlement = await settlementsStore.createSettlement(groupId, {
      toUserId: toUserId.value,
      amount: amount.value,
    })

    stepText.value = 'Готовим транзакцию…'
    const { transaction } = await settlementsStore.prepareTransaction(settlement.id)

    stepText.value = `Подтвердите в ${wallet.walletName}…`
    const signed = await wallet.signTransaction(transaction)

    stepText.value = 'Отправляем в Solana…'
    const signature = await sendBase64Transaction(signed)

    stepText.value = 'Подтверждаем…'
    await settlementsStore.confirmSettlement(settlement.id, signature)
    await settlementsStore.fetchBalance(groupId).catch(() => {})

    success.value = { amount: amount.value, toName: displayName(toUserId.value), signature }
  } catch (e) {
    errorText.value = apiErrorMessage(e)
  } finally {
    paying.value = false
    stepText.value = null
  }
}

/** Off-chain fallback: record the payment, settle on-chain later. */
async function recordManually() {
  paying.value = true
  errorText.value = null
  try {
    const settlement = await settlementsStore.createSettlement(groupId, {
      toUserId: toUserId.value,
      amount: amount.value,
      notes: 'Записано вручную',
    })
    await settlementsStore.updateSettlement(settlement.id, { status: 'completed' })
    await settlementsStore.fetchBalance(groupId).catch(() => {})
    success.value = { amount: amount.value, toName: displayName(toUserId.value) }
  } catch (e) {
    errorText.value = apiErrorMessage(e)
  } finally {
    paying.value = false
  }
}

onMounted(() => {
  wallet.refreshWallets()
  if (!group.value) void groupsStore.fetchGroup(groupId).catch(() => {})
  void settlementsStore.fetchBalance(groupId).catch(() => {})
  if (!toUserId.value) recipientPopupOpen.value = true
})
</script>
