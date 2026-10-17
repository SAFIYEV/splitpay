<template>
  <f7-page>
    <f7-page-content class="relative overflow-hidden">
      <!-- decorative blobs -->
      <div class="sp-blob" style="width: 260px; height: 260px; background: #d9d0ff; top: -70px; left: -60px" />
      <div class="sp-blob" style="width: 220px; height: 220px; background: #d3f5e5; bottom: 10%; right: -80px" />

      <div class="relative z-10 flex min-h-full flex-col px-6 pt-16 pb-8">
        <!-- Logo -->
        <div class="mb-8 flex flex-col items-center text-center">
          <div
            class="mb-4 flex h-20 w-20 items-center justify-center rounded-[22px] text-4xl font-bold text-white"
            style="background: linear-gradient(135deg, #7c6cf0 0%, #9d7bfa 100%); box-shadow: 0 14px 30px rgba(124, 108, 240, 0.4)"
          >
            S
          </div>
          <h1 class="m-0 text-3xl font-bold" style="color: var(--color-accent)">SplitPay</h1>
          <p class="mt-2 mb-0 text-[15px] leading-snug" style="color: var(--color-sub)">
            Делите расходы легко.<br />Оплачивайте в USDC на Solana.
          </p>
        </div>

        <!-- Card -->
        <div class="sp-card p-6">
          <h2 class="m-0 mb-5 text-center text-lg font-bold">Войти в аккаунт</h2>

          <label class="sp-label">Email</label>
          <input
            v-model="email"
            type="email"
            class="sp-input mb-4"
            placeholder="Введите email"
            autocomplete="email"
          />

          <label class="sp-label">Пароль</label>
          <div style="position: relative" class="mb-2">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              class="sp-input"
              style="padding-right: 48px"
              placeholder="Введите пароль"
              autocomplete="current-password"
            />
            <button
              type="button"
              class="border-0 bg-transparent p-0"
              style="position: absolute; top: 50%; right: 16px; transform: translateY(-50%); color: var(--color-sub)"
              @click="showPassword = !showPassword"
            >
              <f7-icon :f7="showPassword ? 'eye_slash' : 'eye'" size="20" />
            </button>
          </div>

          <div class="mb-5 text-right">
            <button type="button" class="border-0 bg-transparent p-0 text-sm font-medium" style="color: var(--color-accent)" @click="forgotPassword">
              Забыли пароль?
            </button>
          </div>

          <button
            type="button"
            class="sp-btn-gradient"
            :disabled="!canSubmit || auth.loading"
            @click="submit"
          >
            {{ auth.loading ? 'Входим…' : 'Войти' }}
          </button>

          <p v-if="errorText" class="mt-3 mb-0 text-center text-sm" style="color: var(--color-rose)">
            {{ errorText }}
          </p>

          <div class="my-5 flex items-center gap-3">
            <div class="h-px flex-1" style="background: #e6e4f2" />
            <span class="text-xs" style="color: var(--color-sub)">или</span>
            <div class="h-px flex-1" style="background: #e6e4f2" />
          </div>

          <button type="button" class="sp-btn-soft flex items-center justify-center gap-2" @click="walletSheetOpen = true">
            <span
              class="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white"
              style="background: linear-gradient(135deg, #9945ff, #14f195)"
            >◎</span>
            Войти через Solana
          </button>
        </div>

        <p class="mt-6 mb-0 text-center text-sm" style="color: var(--color-sub)">
          Нет аккаунта?
          <f7-link href="/register/" class="font-semibold" style="--f7-link-color: var(--color-accent)">
            Зарегистрируйтесь
          </f7-link>
        </p>
      </div>

      <!-- Wallet picker sheet -->
      <f7-sheet v-model:opened="walletSheetOpen" class="sp-sheet" style="height: auto; --f7-sheet-border-radius: 28px">
        <div class="px-6 pt-4 pb-8">
          <div class="mx-auto mb-4 h-1 w-10 rounded-full" style="background: #e6e4f2" />
          <h3 class="m-0 mb-1 text-center text-lg font-bold">Войти через Solana</h3>
          <p class="mt-0 mb-4 text-center text-sm" style="color: var(--color-sub)">
            Подписываем сообщение в кошельке — без пароля
          </p>

          <template v-if="wallet.wallets.length > 0">
            <button
              v-for="w in wallet.wallets"
              :key="w.name"
              type="button"
              class="sp-card-sm mb-3 flex w-full items-center gap-3 border-0 p-4 text-left"
              :disabled="wallet.connecting"
              @click="connectWith(w)"
            >
              <img :src="w.icon" :alt="w.name" class="h-10 w-10 rounded-xl" />
              <span class="flex-1 font-semibold">{{ w.name }}</span>
              <f7-icon f7="chevron_right" size="16" style="color: var(--color-sub)" />
            </button>
          </template>
          <p v-else class="my-4 text-center text-sm" style="color: var(--color-sub)">
            Кошелёк не обнаружен.<br />Установите Phantom, Solflare или Backpack и обновите страницу.
          </p>

          <p v-if="walletError" class="mt-2 mb-0 text-center text-sm" style="color: var(--color-rose)">
            {{ walletError }}
          </p>
        </div>
      </f7-sheet>
    </f7-page-content>
  </f7-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { f7 } from 'framework7-vue'
import { apiErrorMessage } from '@/services/api'
import { assertWalletChallenge } from '@/services/challenge'
import { useAuthStore } from '@/stores/auth'
import { useWalletStore } from '@/stores/wallet'
import type { ConnectableWallet } from '@/services/wallet-adapter'

const auth = useAuthStore()
const wallet = useWalletStore()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const errorText = ref<string | null>(null)
const walletSheetOpen = ref(false)
const walletError = ref<string | null>(null)

const canSubmit = computed(() => email.value.includes('@') && password.value.length > 0)

onMounted(() => wallet.refreshWallets())

async function submit() {
  errorText.value = null
  try {
    await auth.login(email.value.trim(), password.value)
    f7.views.main.router.navigate('/groups/', { clearPreviousHistory: true })
  } catch (e) {
    errorText.value = apiErrorMessage(e)
  }
}

function forgotPassword() {
  f7.dialog.alert('Ссылка для сброса пароля будет отправлена на ваш email.', 'Забыли пароль?')
}

/** Wallet auth flow: connect → challenge → validate → sign → verify (spec 8.1). */
async function connectWith(w: ConnectableWallet) {
  walletError.value = null
  try {
    await wallet.connect(w)
    const address = wallet.address
    if (!address) throw new Error('Кошелёк не вернул адрес')
    const { message } = await auth.walletChallenge(address)
    // Never sign blindly: the challenge must be a well-formed SplitPay
    // message for this wallet, issued within the last minutes.
    assertWalletChallenge(message, address)
    const signature = await wallet.signMessage(message)
    await auth.walletVerify(address, signature)
    walletSheetOpen.value = false
    f7.views.main.router.navigate('/groups/', { clearPreviousHistory: true })
  } catch (e) {
    walletError.value = apiErrorMessage(e)
    await wallet.disconnect().catch(() => {})
  }
}
</script>
