<template>
  <f7-app v-bind="f7params">
    <!--
      No browser-history: with browserHistory + asyncComponent, f7-view renders
      the route's import function as the initial page ("[object Promise]" in
      the DOM) and the F7 router adopts that placeholder as the current page.
      In-memory history + the '/' function redirect is the standard PWA setup.
    -->
    <f7-view main url="/" />
  </f7-app>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { f7 } from 'framework7-vue'
import { useAuthStore } from '@/stores/auth'
import { useWalletStore } from '@/stores/wallet'
import { connectWebSocket, disconnectWebSocket } from '@/services/websocket'
import routes from '@/routes'

const auth = useAuthStore()
const wallet = useWalletStore()

const f7params = {
  theme: 'ios' as const, // design mockups are iOS-styled; force on all devices
  name: 'SplitPay',
  id: 'com.splitpay.app',
  routes,
  darkMode: false as const,
}

function onUnauthorized() {
  auth.logout()
  f7.views.main?.router.navigate('/login/')
}

onMounted(() => {
  wallet.init()
  if (auth.isAuthenticated) {
    void auth.fetchMe().catch(() => {})
    if (auth.tokens?.accessToken) connectWebSocket(auth.tokens.accessToken)
  }
  window.addEventListener('splitpay:unauthorized', onUnauthorized)
})

watch(
  () => auth.tokens?.accessToken,
  (token, previous) => {
    if (token && token !== previous) connectWebSocket(token)
    if (!token && previous) disconnectWebSocket()
  },
)

onBeforeUnmount(() => {
  window.removeEventListener('splitpay:unauthorized', onUnauthorized)
})
</script>
