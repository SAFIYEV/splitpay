<template>
  <f7-page>
    <f7-navbar title="Settle up" back-link="Back" />

    <f7-block class="mb-2">
      <p class="m-0 opacity-70">
        Pay a member directly in USDC on Solana. The payment is verified on-chain and the debt is
        closed automatically.
      </p>
    </f7-block>

    <f7-block-title>Pay to</f7-block-title>
    <f7-list strong inset dividers>
      <f7-list-item
        v-for="member in otherMembers"
        :key="member.userId"
        radio
        name="recipient"
        :checked="toUserId === member.userId"
        :title="displayName(member.userId)"
        @change="toUserId = member.userId"
      >
        <template #media>
          <UserAvatar :name="displayName(member.userId)" :size="32" />
        </template>
        <template v-if="owedTo(member.userId) > 0" #subtitle>
          you owe {{ formatUsdc(owedTo(member.userId)) }}
        </template>
      </f7-list-item>
    </f7-list>

    <f7-list strong inset dividers form @submit.prevent>
      <f7-list-input
        v-model:value="amountText"
        label="Amount (USDC)"
        type="number"
        inputmode="decimal"
        step="0.01"
        min="0"
        placeholder="0.00"
      />
      <f7-list-input
        v-model:value="note"
        label="Note"
        type="text"
        placeholder="Optional"
        clear-button
      />
    </f7-list>

    <!-- Wallet section -->
    <f7-block-title>Paying from</f7-block-title>
    <f7-list v-if="wallet.isConnected" strong inset>
      <f7-list-item :title="wallet.walletName ?? 'Wallet'" :subtitle="truncateAddress(wallet.address ?? '', 8, 8)">
        <template #media>
          <img
            v-if="wallet.connected?.wallet.icon"
            :src="wallet.connected.wallet.icon"
            class="h-8 w-8 rounded-lg"
            :alt="wallet.walletName ?? ''"
          />
        </template>
        <template #after>
          <span class="text-sm opacity-60">{{ wallet.solBalance?.toFixed(3) ?? '—' }} SOL</span>
        </template>
      </f7-list-item>
    </f7-list>
    <f7-list v-else-if="wallet.wallets.length > 0" strong inset>
      <f7-list-item
        v-for="w in wallet.wallets"
        :key="w.name"
        link
        :title="`Connect ${w.name}`"
        :disabled="wallet.connecting"
        @click="wallet.connect(w).catch(() => {})"
      >
        <template #media>
          <img :src="w.icon" :alt="w.name" class="h-8 w-8 rounded-lg" />
        </template>
      </f7-list-item>
    </f7-list>
    <f7-block v-else class="my-2 text-sm opacity-60">
      No Solana wallet detected. Install Phantom, Solflare or Backpack to pay on-chain — you can
      still record the payment manually below.
    </f7-block>

    <f7-block class="mt-4">
      <f7-button
        v-if="wallet.isConnected"
        large
        fill
        round
        preloader
        :loading="paying"
        :disabled="!canPay"
        @click="payWithWallet"
      >
        Pay {{ amount > 0 ? formatUsdc(amount) : '' }} on-chain
      </f7-button>
      <f7-button
        v-else
        large
        fill
        round
        preloader
        :loading="paying"
        :disabled="!canPay"
        @click="recordManually"
      >
        Record payment
      </f7-button>
      <p v-if="stepText" class="mt-3 mb-0 text-center text-sm opacity-70">{{ stepText }}</p>
      <p v-if="errorText" class="mt-3 mb-0 text-center text-sm text-red-500">{{ errorText }}</p>
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { f7 } from 'framework7-vue'
import type { Router } from 'framework7/types'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { apiErrorMessage } from '@/services/api'
import { sendBase64Transaction } from '@/services/solana'
import { formatUsdc, truncateAddress } from '@/services/utils/format'
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
const toUserId = ref(props.f7route.query.to ?? '')
const amountText = ref(props.f7route.query.amount ?? '')
const note = ref('')
const paying = ref(false)
const stepText = ref<string | null>(null)
const errorText = ref<string | null>(null)

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

/** How much the current user owes this member, from the suggested debt graph. */
function owedTo(userId: string): number {
  const balance = settlementsStore.balanceByGroup[groupId]
  const debt = balance?.debts.find(
    (d) => d.fromUserId === auth.user?.id && d.toUserId === userId,
  )
  return debt?.amount ?? 0
}

/** On-chain flow (spec 5.2): create → prepare-tx → sign → broadcast → confirm. */
async function payWithWallet() {
  paying.value = true
  errorText.value = null
  try {
    stepText.value = 'Creating settlement request…'
    const settlement = await settlementsStore.createSettlement(groupId, {
      toUser: toUserId.value,
      amount: amount.value,
      notes: note.value.trim() || undefined,
    })

    stepText.value = 'Preparing transaction…'
    const { transaction } = await settlementsStore.prepareTransaction(settlement.id)

    stepText.value = `Approve in ${wallet.walletName}…`
    const signed = await wallet.signTransaction(transaction)

    stepText.value = 'Broadcasting to Solana…'
    const signature = await sendBase64Transaction(signed)

    stepText.value = 'Confirming…'
    await settlementsStore.confirmSettlement(settlement.id, signature)
    await settlementsStore.fetchBalance(groupId).catch(() => {})

    f7.toast
      .create({ text: `Paid ${formatUsdc(amount.value)} to ${displayName(toUserId.value)}`, position: 'center', closeTimeout: 2500 })
      .open()
    props.f7router.navigate(`/groups/${groupId}/balances/`, { clearPreviousHistory: true })
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
      toUser: toUserId.value,
      amount: amount.value,
      notes: note.value.trim() || undefined,
    })
    await settlementsStore.updateSettlement(settlement.id, { status: 'completed' })
    await settlementsStore.fetchBalance(groupId).catch(() => {})
    f7.toast.create({ text: 'Payment recorded', position: 'center', closeTimeout: 2000 }).open()
    props.f7router.back()
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
})
</script>
