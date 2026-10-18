import { vi } from 'vitest'

export interface FetchResponseInit {
  status: number
  body?: unknown
  blobText?: string
  headers?: Record<string, string>
}

export function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
    blob: async () => new Blob(),
  } as unknown as Response
}

export function stubFetchResponse(init: FetchResponseInit): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({
    ok: init.status >= 200 && init.status < 300,
    status: init.status,
    headers: { get: (name: string) => init.headers?.[name.toLowerCase()] ?? null },
    json: async () => init.body,
    blob: async () => new Blob([init.blobText ?? '']),
  })
  vi.stubGlobal('fetch', fn)
  return fn
}
