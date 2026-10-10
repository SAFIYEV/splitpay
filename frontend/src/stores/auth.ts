import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api, tokenStorage } from '@/services/api'
import type { AuthResponse, AuthTokens, User } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const tokens = ref<AuthTokens | null>(tokenStorage.load())
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!tokens.value?.accessToken)

  function setAuth(data: AuthResponse) {
    user.value = data.user
    tokens.value = { accessToken: data.accessToken, refreshToken: data.refreshToken }
    tokenStorage.save(tokens.value)
  }

  async function login(email: string, password: string) {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.post<AuthResponse>('/auth/login', { email, password })
      setAuth(data)
    } finally {
      loading.value = false
    }
  }

  async function register(email: string, password: string, displayName: string) {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.post<AuthResponse>('/auth/register', {
        email,
        password,
        displayName,
      })
      setAuth(data)
    } finally {
      loading.value = false
    }
  }

  /** Wallet auth, step 1: get a challenge message to sign. */
  async function walletChallenge(walletAddress: string): Promise<{ message: string }> {
    const { data } = await api.post<{ message: string }>('/auth/wallet/challenge', {
      walletAddress,
    })
    return data
  }

  /** Wallet auth, step 2: submit the signature and receive JWT tokens. */
  async function walletVerify(walletAddress: string, signatureBase64: string) {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.post<AuthResponse>('/auth/wallet/verify', {
        walletAddress,
        signature: signatureBase64,
      })
      setAuth(data)
    } finally {
      loading.value = false
    }
  }

  async function fetchMe() {
    if (!tokens.value?.accessToken) return
    const { data } = await api.get<User>('/auth/me')
    user.value = data
  }

  async function updateProfile(patch: Partial<Pick<User, 'displayName' | 'avatar' | 'walletAddress'>>) {
    const { data } = await api.patch<User>('/auth/me', patch)
    user.value = data
  }

  function logout() {
    user.value = null
    tokens.value = null
    tokenStorage.clear()
  }

  return {
    user,
    tokens,
    loading,
    error,
    isAuthenticated,
    login,
    register,
    walletChallenge,
    walletVerify,
    fetchMe,
    updateProfile,
    logout,
  }
})
