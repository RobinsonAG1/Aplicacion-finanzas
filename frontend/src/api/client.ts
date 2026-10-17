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

async function authFetch(path: string, init: RequestInit, auth: boolean): Promise<Response> {
  const withAuth = (): RequestInit => {
    if (!auth) return init
    const headers = new Headers(init.headers)
    const token = tokenStore.getAccess()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return { ...init, headers }
  }

  let response = await fetch(`${env.apiUrl}${path}`, withAuth())
  if (response.status === 401 && auth && (await refreshTokens())) {
    response = await fetch(`${env.apiUrl}${path}`, withAuth())
  }
  return response
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, signal } = options

  const init: RequestInit = { method, signal }
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }

  const response = await authFetch(path, init, auth)
  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const response = await authFetch(path, { method: 'POST', body: formData }, true)
  if (!response.ok) throw await toApiError(response)
  return (await response.json()) as T
}

export async function apiDownload(path: string): Promise<{ blob: Blob; filename: string }> {
  const response = await authFetch(path, { method: 'GET' }, true)
  if (!response.ok) throw await toApiError(response)
  const blob = await response.blob()
  const disposition = response.headers.get('content-disposition') ?? ''
  const match = /filename="?([^";]+)"?/.exec(disposition)
  return { blob, filename: match?.[1] ?? 'descarga.csv' }
}
