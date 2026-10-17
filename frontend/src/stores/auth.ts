import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api, profileStorage, tokenStorage } from '@/services/api'
import type { AuthResponse, AuthTokens, User } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  // Hydrate from localStorage so identity survives a reload even if /auth/me
  // is briefly unreachable at boot (backend restart, flaky network).
  const user = ref<User | null>(profileStorage.load())
  const tokens = ref<AuthTokens | null>(tokenStorage.load())
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!tokens.value?.accessToken)

  function setUser(next: User) {
    user.value = next
    profileStorage.save(next)
  }

  function setAuth(data: AuthResponse) {
    setUser(data.user)
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

  /** Wallet auth, step 2: submit the base58 signature and receive JWT tokens. */
  async function walletVerify(walletAddress: string, signatureBase58: string) {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.post<AuthResponse>('/auth/wallet/verify', {
        walletAddress,
        signature: signatureBase58,
      })
      setAuth(data)
    } finally {
      loading.value = false
    }
  }

  /** Link a wallet to the account after a signed ownership challenge
   *  (backend verifies the signature — arbitrary addresses are rejected). */
  async function linkWallet(walletAddress: string, signatureBase58: string) {
    const { data } = await api.post<User>('/auth/wallet/link', {
      walletAddress,
      signature: signatureBase58,
    })
    setUser(data)
  }

  async function fetchMe() {
    if (!tokens.value?.accessToken) return
    const { data } = await api.get<User>('/auth/me')
    setUser(data)
  }

  async function updateProfile(patch: Partial<Pick<User, 'displayName' | 'avatar'>>) {
    const { data } = await api.patch<User>('/auth/me', patch)
    setUser(data)
  }

  function logout() {
    const refreshToken = tokens.value?.refreshToken
    user.value = null
    tokens.value = null
    tokenStorage.clear()
    profileStorage.clear()
    // Drop service-worker cached API responses so nothing personal survives
    // logout on a shared device.
    if ('caches' in window) void caches.delete('splitpay-api').catch(() => {})
    // Best-effort server-side revocation of the refresh grant.
    if (refreshToken) void api.post('/auth/logout', { refreshToken }).catch(() => {})
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
    linkWallet,
    fetchMe,
    updateProfile,
    logout,
  }
})
