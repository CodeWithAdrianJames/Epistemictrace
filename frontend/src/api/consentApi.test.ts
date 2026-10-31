import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './ApiError.ts'
import { putConsent } from './consentApi.ts'

const BASE_URL = 'http://api.test'
const TOKEN = 'token-1'
const ACCEPTED_AT = '2026-10-31T08:00:00Z'

const fetchMock = vi.fn<typeof fetch>()

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function problemResponse(status: number, detail: string): Response {
  return new Response(JSON.stringify({ title: `HTTP ${status}`, status, detail }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}

function lastRequest(): { url: string; init: RequestInit; headers: Record<string, string> } {
  const call = fetchMock.mock.lastCall
  if (!call) {
    throw new Error('fetch was not called')
  }
  const [url, init = {}] = call
  return { url: String(url), init, headers: (init.headers ?? {}) as Record<string, string> }
}

async function catchApiError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof ApiError) {
      return error
    }
    throw error
  }
  throw new Error('Expected the call to reject with an ApiError')
}

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', BASE_URL)
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe('putConsent', () => {
  it('sends PUT /api/me/consent with the bearer token and no body', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ consentAcceptedAt: ACCEPTED_AT }))

    await putConsent(TOKEN)

    const { url, init, headers } = lastRequest()
    expect(url).toBe(`${BASE_URL}/api/me/consent`)
    expect(init.method).toBe('PUT')
    expect(init.body).toBeUndefined()
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(headers['Content-Type']).toBeUndefined()
  })

  it('returns the recorded timestamp', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ consentAcceptedAt: ACCEPTED_AT }))

    await expect(putConsent(TOKEN)).resolves.toEqual({ consentAcceptedAt: ACCEPTED_AT })
  })

  it('passes the abort signal to fetch', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ consentAcceptedAt: ACCEPTED_AT }))
    const controller = new AbortController()

    await putConsent(TOKEN, controller.signal)

    expect(lastRequest().init.signal).toBe(controller.signal)
  })

  it.each([
    ['an array', []],
    ['an empty object', {}],
    ['a missing timestamp', { other: 1 }],
    ['a number timestamp', { consentAcceptedAt: 5 }],
    ['an unparseable timestamp', { consentAcceptedAt: 'not a date' }],
  ])('rejects an unreadable body: %s', async (_name, body) => {
    fetchMock.mockResolvedValue(jsonResponse(body))

    const error = await catchApiError(putConsent(TOKEN))

    expect(error.status).toBe(200)
    expect(error.title).toBe('Unreadable response')
  })

  it.each([401, 403, 500])('throws an ApiError carrying the server detail for %i', async (status) => {
    fetchMock.mockResolvedValue(problemResponse(status, `detail ${status}`))

    const error = await catchApiError(putConsent(TOKEN))

    expect(error.status).toBe(status)
    expect(error.detail).toBe(`detail ${status}`)
  })

  it('throws a network ApiError when fetch fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const error = await catchApiError(putConsent(TOKEN))

    expect(error.status).toBe(0)
  })
})
