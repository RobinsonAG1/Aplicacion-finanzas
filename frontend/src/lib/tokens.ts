const ACCESS_KEY = 'finanzas.accessToken'
const REFRESH_KEY = 'finanzas.refreshToken'

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* almacenamiento no disponible */
  }
}

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* almacenamiento no disponible */
  }
}

export const tokenStore = {
  getAccess(): string | null {
    return safeGet(ACCESS_KEY)
  },
  getRefresh(): string | null {
    return safeGet(REFRESH_KEY)
  },
  set(tokens: { access: string; refresh: string }): void {
    safeSet(ACCESS_KEY, tokens.access)
    safeSet(REFRESH_KEY, tokens.refresh)
  },
  clear(): void {
    safeRemove(ACCESS_KEY)
    safeRemove(REFRESH_KEY)
  },
}
