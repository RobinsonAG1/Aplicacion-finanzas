import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { authApi } from '../../api/auth'
import type { LoginInput, RegisterInput } from '../../api/auth'
import { tokenStore } from '../../lib/tokens'
import type { User } from '../../api/types'
import { AuthContext } from './auth-context'
import type { AuthContextValue } from './auth-context'

function applySession(session: { accessToken: string }): void {
  tokenStore.setAccess(session.accessToken)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    // No hay access token en memoria al cargar: /me devolvera 401 y el cliente
    // renovara con la cookie HttpOnly; si falla, la sesion queda vacia.
    async function bootstrap(): Promise<void> {
      try {
        const current = await authApi.me()
        if (active) setUser(current)
      } catch {
        tokenStore.clear()
      } finally {
        if (active) setLoading(false)
      }
    }

    void bootstrap()
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (input: LoginInput) => {
    const result = await authApi.login(input)
    applySession(result)
    setUser(result.user)
  }, [])

  const register = useCallback(async (input: RegisterInput) => {
    const result = await authApi.register(input)
    applySession(result)
    setUser(result.user)
  }, [])

  const logout = useCallback(async () => {
    tokenStore.clear()
    setUser(null)
    try {
      await authApi.logout()
    } catch {
      /* el logout local ya se aplico */
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
