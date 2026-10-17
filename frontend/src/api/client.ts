import { env } from '../lib/env'
import { tokenStore } from '../lib/tokens'
import type { ApiErrorBody, AuthResponse } from './types'

export class ApiError extends Error {
  public readonly status: number
  public readonly code?: string
  public readonly details?: unknown

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  auth?: boolean
  signal?: AbortSignal
}

let refreshInFlight: Promise<boolean> | null = null

async function refreshTokens(): Promise<boolean> {
  const refreshToken = tokenStore.getRefresh()
  if (!refreshToken) return false
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${env.apiUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })
        if (!res.ok) {
          tokenStore.clear()
          return false
        }
        const data = (await res.json()) as AuthResponse
        tokenStore.set({ access: data.accessToken, refresh: data.refreshToken })
        return true
      } catch {
        tokenStore.clear()
        return false
      } finally {
        refreshInFlight = null
      }
    })()
  }
  return refreshInFlight
}

async function toApiError(response: Response): Promise<ApiError> {
  let message = `Error ${response.status}`
  let code: string | undefined
  let details: unknown
  try {
    const body = (await response.json()) as ApiErrorBody
    if (body?.error) {
      message = body.error.message ?? message
      code = body.error.code
      details = body.error.details
    }
  } catch {
    /* respuesta sin cuerpo JSON */
  }
  return new ApiError(response.status, message, code, details)
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, signal } = options

  const send = (): Promise<Response> => {
    const headers: Record<string, string> = {}
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (auth) {
      const token = tokenStore.getAccess()
      if (token) headers.Authorization = `Bearer ${token}`
    }
    return fetch(`${env.apiUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  }

  let response = await send()
  if (response.status === 401 && auth) {
    const refreshed = await refreshTokens()
    if (refreshed) response = await send()
  }

  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
