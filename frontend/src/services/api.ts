import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { AuthTokens } from '@/types'

const TOKEN_STORAGE_KEY = 'splitpay.tokens'

/** Token persistence kept outside Pinia so axios interceptors never import stores (no cycles). */
export const tokenStorage = {
  load(): AuthTokens | null {
    try {
      const raw = localStorage.getItem(TOKEN_STORAGE_KEY)
      return raw ? (JSON.parse(raw) as AuthTokens) : null
    } catch {
      return null
    }
  },
  save(tokens: AuthTokens) {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens))
  },
  clear() {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  },
}

function notifyUnauthorized() {
  tokenStorage.clear()
  window.dispatchEvent(new CustomEvent('splitpay:unauthorized'))
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1',
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const tokens = tokenStorage.load()
  if (tokens?.accessToken) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`
  }
  return config
})

// ---- Refresh-token retry logic ----
let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  const tokens = tokenStorage.load()
  if (!tokens?.refreshToken) throw new Error('No refresh token')

  const { data } = await axios.post<Partial<AuthTokens> & { accessToken: string }>(
    `${api.defaults.baseURL}/auth/refresh`,
    { refreshToken: tokens.refreshToken },
  )

  const next: AuthTokens = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken ?? tokens.refreshToken,
  }
  tokenStorage.save(next)
  return next.accessToken
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined

    if (error.response?.status !== 401 || !original || original._retried) {
      return Promise.reject(error)
    }
    // Never try to refresh the refresh call itself.
    if (original.url?.includes('/auth/refresh')) {
      notifyUnauthorized()
      return Promise.reject(error)
    }

    original._retried = true
    try {
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null
      })
      const accessToken = await refreshPromise
      original.headers.Authorization = `Bearer ${accessToken}`
      return api(original)
    } catch (refreshError) {
      notifyUnauthorized()
      return Promise.reject(refreshError)
    }
  },
)

/** Extract a human-readable message from an axios error. */
export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[] } | undefined
    if (Array.isArray(data?.message)) return data.message.join(', ')
    if (data?.message) return data.message
    if (error.code === 'ERR_NETWORK') return 'Cannot reach the server. Check your connection.'
    return error.message
  }
  return error instanceof Error ? error.message : 'Unexpected error'
}
