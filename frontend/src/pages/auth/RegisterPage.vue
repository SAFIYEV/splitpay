<template>
  <f7-page>
    <f7-navbar title="Create account" back-link="Sign in" />

    <f7-block class="mb-2 text-center">
      <h1 class="m-0 text-2xl font-bold">Join SplitPay</h1>
      <p class="mt-1 mb-0 opacity-60">Split group expenses and settle instantly in USDC.</p>
    </f7-block>

    <f7-list strong inset dividers form @submit.prevent>
      <f7-list-input
        v-model:value="displayName"
        label="Display name"
        type="text"
        placeholder="Alex"
        autocomplete="name"
        clear-button
      />
      <f7-list-input
        v-model:value="email"
        label="Email"
        type="email"
        placeholder="you@example.com"
        autocomplete="email"
        clear-button
      />
      <f7-list-input
        v-model:value="password"
        label="Password"
        type="password"
        placeholder="At least 8 characters"
        autocomplete="new-password"
        clear-button
      />
      <f7-list-input
        v-model:value="confirm"
        label="Confirm password"
        type="password"
        placeholder="Repeat the password"
        autocomplete="new-password"
        clear-button
      />
    </f7-list>

    <f7-block class="mt-4">
      <f7-button large fill round preloader :loading="auth.loading" :disabled="!canSubmit" @click="submit">
        Create account
      </f7-button>
      <p v-if="errorText" class="mt-3 mb-0 text-center text-sm text-red-500">{{ errorText }}</p>
      <p v-if="mismatch" class="mt-3 mb-0 text-center text-sm text-red-500">Passwords do not match</p>
      <p class="mt-4 mb-0 text-center text-sm opacity-70">
        Already have an account?
        <f7-link href="/login/" class="font-semibold">Sign in</f7-link>
      </p>
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { f7 } from 'framework7-vue'
import { apiErrorMessage } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const displayName = ref('')
const email = ref('')
const password = ref('')
const confirm = ref('')
const errorText = ref<string | null>(null)

const mismatch = computed(() => confirm.value.length > 0 && confirm.value !== password.value)
const canSubmit = computed(
  () =>
    displayName.value.trim().length >= 2 &&
    email.value.includes('@') &&
    password.value.length >= 8 &&
    !mismatch.value,
)

async function submit() {
  errorText.value = null
  try {
    await auth.register(email.value.trim(), password.value, displayName.value.trim())
    f7.toast
      .create({ text: 'Welcome to SplitPay!', position: 'center', closeTimeout: 2000 })
      .open()
    f7.views.main.router.navigate('/groups/', { clearPreviousHistory: true })
  } catch (e) {
    errorText.value = apiErrorMessage(e)
  }
}
</script>
