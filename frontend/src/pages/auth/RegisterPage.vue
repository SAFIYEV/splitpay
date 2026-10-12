<template>
  <f7-page>
    <f7-page-content class="relative overflow-hidden">
      <div class="sp-blob" style="width: 240px; height: 240px; background: #d9d0ff; top: -60px; right: -70px" />

      <div class="relative z-10 flex min-h-full flex-col px-6 pt-6 pb-8">
        <button type="button" class="sp-icon-btn mb-5" @click="back">
          <f7-icon f7="chevron_left" size="20" />
        </button>

        <h1 class="m-0 text-2xl font-bold">Создать аккаунт</h1>
        <p class="mt-1 mb-6 text-[15px]" style="color: var(--color-sub)">
          Присоединяйтесь к SplitPay и делите расходы без лишних хлопот
        </p>

        <div class="sp-card p-6">
          <label class="sp-label">Имя</label>
          <input v-model="displayName" type="text" class="sp-input mb-4" placeholder="Введите ваше имя" autocomplete="name" />

          <label class="sp-label">Email</label>
          <input v-model="email" type="email" class="sp-input mb-4" placeholder="Введите email" autocomplete="email" />

          <label class="sp-label">Пароль</label>
          <div style="position: relative" class="mb-2">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              class="sp-input"
              style="padding-right: 48px"
              placeholder="Создайте пароль"
              autocomplete="new-password"
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

          <!-- Live password guidance (UI only — server rule is just ≥ 8 chars) -->
          <div class="mb-4 flex flex-col gap-1.5 px-1">
            <div v-for="rule in rules" :key="rule.label" class="flex items-center gap-2 text-[13px]"
              :style="{ color: rule.ok ? 'var(--color-mint)' : 'var(--color-sub)' }">
              <span
                class="flex h-4.5 w-4.5 items-center justify-center rounded-full border"
                :style="rule.ok ? 'background: var(--color-mint); border-color: var(--color-mint)' : 'border-color: #cfcde0'"
              >
                <f7-icon v-if="rule.ok" f7="checkmark" size="10" color="white" />
              </span>
              {{ rule.label }}
            </div>
          </div>

          <label class="sp-label">Подтвердите пароль</label>
          <div style="position: relative" class="mb-4">
            <input
              v-model="confirm"
              :type="showPassword ? 'text' : 'password'"
              class="sp-input"
              style="padding-right: 48px"
              placeholder="Повторите пароль"
              autocomplete="new-password"
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
          <p v-if="mismatch" class="mt-0 mb-3 px-1 text-[13px]" style="color: var(--color-rose)">
            Пароли не совпадают
          </p>

          <label class="mb-5 flex cursor-pointer items-start gap-2.5 text-[13px]" style="color: var(--color-sub)">
            <input v-model="terms" type="checkbox" class="mt-0.5 h-4.5 w-4.5 accent-[#6d5be2]" />
            <span>Я соглашаюсь с <b style="color: var(--color-accent)">Условиями использования</b> и <b style="color: var(--color-accent)">Политикой конфиденциальности</b></span>
          </label>

          <button type="button" class="sp-btn-gradient" :disabled="!canSubmit" @click="submit">
            {{ auth.loading ? 'Создаём…' : 'Создать аккаунт' }}
          </button>

          <p v-if="errorText" class="mt-3 mb-0 text-center text-sm" style="color: var(--color-rose)">
            {{ errorText }}
          </p>
        </div>

        <p class="mt-6 mb-0 text-center text-sm" style="color: var(--color-sub)">
          Уже есть аккаунт?
          <f7-link href="/login/" class="font-semibold" style="--f7-link-color: var(--color-accent)">Войти</f7-link>
        </p>
      </div>
    </f7-page-content>
  </f7-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { f7 } from 'framework7-vue'
import type { Router } from 'framework7/types'
import { apiErrorMessage } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ f7router: Router.Router }>()

const auth = useAuthStore()

const displayName = ref('')
const email = ref('')
const password = ref('')
const confirm = ref('')
const terms = ref(false)
const showPassword = ref(false)
const errorText = ref<string | null>(null)

const rules = computed(() => [
  { label: 'Минимум 8 символов', ok: password.value.length >= 8 },
  { label: 'Одна заглавная буква', ok: /[A-ZА-Я]/.test(password.value) },
  { label: 'Одна цифра', ok: /\d/.test(password.value) },
])

const mismatch = computed(() => confirm.value.length > 0 && confirm.value !== password.value)
const canSubmit = computed(
  () =>
    displayName.value.trim().length >= 2 &&
    email.value.includes('@') &&
    password.value.length >= 8 && // server rule (RegisterDto MinLength 8)
    !mismatch.value &&
    terms.value &&
    !auth.loading,
)

function back() {
  props.f7router.back()
}

async function submit() {
  errorText.value = null
  try {
    await auth.register(email.value.trim(), password.value, displayName.value.trim())
    f7.toast.create({ text: 'Добро пожаловать в SplitPay!', position: 'center', closeTimeout: 2000 }).open()
    f7.views.main.router.navigate('/groups/', { clearPreviousHistory: true })
  } catch (e) {
    errorText.value = apiErrorMessage(e)
  }
}
</script>
