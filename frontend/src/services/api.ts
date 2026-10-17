import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { AuthTokens, User } from '@/types'

const TOKEN_STORAGE_KEY = 'splitpay.tokens'
const PROFILE_STORAGE_KEY = 'splitpay.profile'

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

/**
 * Last known user profile, cached so identity survives a reload even when
 * /auth/me is briefly unreachable at boot (backend restart, offline).
 */
export const profileStorage = {
  load(): User | null {
    try {
      const raw = localStorage.getItem(PROFILE_STORAGE_KEY)
      return raw ? (JSON.parse(raw) as User) : null
    } catch {
      return null
    }
  },
  save(user: User) {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(user))
  },
  clear() {
    localStorage.removeItem(PROFILE_STORAGE_KEY)
  },
}

function notifyUnauthorized() {
  tokenStorage.clear()
  profileStorage.clear()
  window.dispatchEvent(new CustomEvent('splitpay:unauthorized'))
}

// Production builds must never fall back to plain-http localhost defaults:
// misconfiguration must fail loudly instead of leaking tokens.
const baseURL =
  import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3000/api/v1' : undefined)
if (!baseURL) {
  throw new Error('VITE_API_URL is not configured')
}

export const api = axios.create({
  baseURL,
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
      // Hard-logout only when the server definitively rejects the refresh token.
      // Transient failures (backend restart, offline) keep the session — the
      // next request will retry the refresh.
      const status = axios.isAxiosError(refreshError) ? refreshError.response?.status : undefined
      if (status === 400 || status === 401 || status === 403) {
        notifyUnauthorized()
      }
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
    if (error.code === 'ERR_NETWORK') return 'Не удалось связаться с сервером. Проверьте соединение.'
    return error.message
  }
  return error instanceof Error ? error.message : 'Unexpected error'
}
