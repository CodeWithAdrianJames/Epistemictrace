import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './ApiError.ts'
import { endSession, parseBreaker, sendEvents, startSession, type TelemetryEvent } from './sessionsApi.ts'

const BASE_URL = 'http://api.test'
const TOKEN = 'token-1'
const STARTED_AT = '2026-11-03T02:00:00Z'

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

const SESSION = { sessionId: 5, activityId: 42, startedAt: STARTED_AT, resumed: false }

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', BASE_URL)
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe('startSession', () => {
  it('sends POST /api/sessions with the activity id and the bearer token', async () => {
    fetchMock.mockResolvedValue(jsonResponse(SESSION, 201))
    const controller = new AbortController()

    await expect(startSession(TOKEN, 42, controller.signal)).resolves.toEqual(SESSION)

    const { url, init, headers } = lastRequest()
    expect(url).toBe(`${BASE_URL}/api/sessions`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ activityId: 42 })
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(init.signal).toBe(controller.signal)
  })

  it('keeps fields later specs add to the body', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...SESSION, resumed: true, breaker: { state: 'LOCKED' } }))
    await expect(startSession(TOKEN, 42)).resolves.toEqual({ ...SESSION, resumed: true, breaker: { state: 'LOCKED' } })
  })

  it.each([
    ['a missing sessionId', { ...SESSION, sessionId: undefined }],
    ['a non-integer sessionId', { ...SESSION, sessionId: 1.5 }],
    ['a missing activityId', { ...SESSION, activityId: undefined }],
    ['an unparsable startedAt', { ...SESSION, startedAt: 'yesterday' }],
    ['a non-boolean resumed', { ...SESSION, resumed: 'no' }],
    ['an array', [SESSION]],
  ])('rejects a body with %s', async (_, body) => {
    fetchMock.mockResolvedValue(jsonResponse(body))
    const error = await catchApiError(startSession(TOKEN, 42))
    expect(error.title).toBe('Unreadable response')
  })

  it('passes a 403 consent error through', async () => {
    fetchMock.mockResolvedValue(problemResponse(403, 'Consent is required before tracking starts.'))
    const error = await catchApiError(startSession(TOKEN, 42))
    expect(error.status).toBe(403)
    expect(error.detail).toBe('Consent is required before tracking starts.')
  })
})

describe('endSession', () => {
  it('sends POST /api/sessions/{id}/end with keepalive', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(endSession(TOKEN, 5, { keepalive: true })).resolves.toBeUndefined()

    const { url, init, headers } = lastRequest()
    expect(url).toBe(`${BASE_URL}/api/sessions/5/end`)
    expect(init.method).toBe('POST')
    expect(init.body).toBeUndefined()
    expect(init.keepalive).toBe(true)
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`)
  })

  it('does not ask for keepalive by default', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await endSession(TOKEN, 5)
    expect(lastRequest().init.keepalive).toBeUndefined()
  })
})

describe('sendEvents', () => {
  const EVENTS: TelemetryEvent[] = [
    { clientEventId: 'a', type: 'EDIT', occurredAt: STARTED_AT, charsAdded: 3, charsRemoved: 0 },
    { clientEventId: 'b', type: 'ERROR', occurredAt: STARTED_AT, errorSignature: 'NameError@3' },
    { clientEventId: 'c', type: 'RUN', occurredAt: STARTED_AT, passedCount: 1, totalCount: 4 },
  ]

  it('sends the events exactly as given under "events"', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ accepted: 3, duplicates: 0 }))

    await expect(sendEvents(TOKEN, 5, EVENTS)).resolves.toEqual({ accepted: 3, duplicates: 0 })

    const { url, init } = lastRequest()
    expect(url).toBe(`${BASE_URL}/api/sessions/5/events`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ events: EVENTS })
    expect(init.keepalive).toBeUndefined()
  })

  it('passes keepalive on', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ accepted: 3, duplicates: 0 }))
    await sendEvents(TOKEN, 5, EVENTS, { keepalive: true })
    expect(lastRequest().init.keepalive).toBe(true)
  })

  it('keeps fields later specs add to the response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ accepted: 1, duplicates: 2, struggleLevel: 'LOW' }))
    await expect(sendEvents(TOKEN, 5, EVENTS)).resolves.toEqual({ accepted: 1, duplicates: 2, struggleLevel: 'LOW' })
  })

  it.each([
    ['a missing accepted', { duplicates: 0 }],
    ['a negative duplicates', { accepted: 1, duplicates: -1 }],
    ['a string count', { accepted: '1', duplicates: 0 }],
  ])('rejects a body with %s', async (_, body) => {
    fetchMock.mockResolvedValue(jsonResponse(body))
    const error = await catchApiError(sendEvents(TOKEN, 5, EVENTS))
    expect(error.title).toBe('Unreadable response')
  })

  it('passes a 400 with field errors through', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ status: 400, detail: 'Invalid request content.', errors: { 'events[0].charsAdded': 'bad' } }),
        { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    )
    const error = await catchApiError(sendEvents(TOKEN, 5, EVENTS))
    expect(error.status).toBe(400)
    expect(error.fieldErrors).toEqual({ 'events[0].charsAdded': 'bad' })
  })
})

describe('parseBreaker', () => {
  it('accepts the three states', () => {
    expect(parseBreaker({ state: 'UNLOCKED', cooldownEndsAt: null, reflectionMinLength: 20 })).toEqual({
      state: 'UNLOCKED',
      cooldownEndsAt: null,
      reflectionMinLength: 20,
    })
    expect(parseBreaker({ state: 'LOCKED', cooldownEndsAt: null, reflectionMinLength: 20 })?.state).toBe('LOCKED')
    expect(parseBreaker({ state: 'COOLDOWN', cooldownEndsAt: STARTED_AT, reflectionMinLength: 20 })).toEqual({
      state: 'COOLDOWN',
      cooldownEndsAt: STARTED_AT,
      reflectionMinLength: 20,
    })
  })

  it('drops fields it does not know, including any SDI value', () => {
    expect(parseBreaker({ state: 'LOCKED', cooldownEndsAt: null, reflectionMinLength: 20, sdiAtLock: 88 })).toEqual({
      state: 'LOCKED',
      cooldownEndsAt: null,
      reflectionMinLength: 20,
    })
  })

  it('ignores a cooldown end outside the COOLDOWN state', () => {
    expect(parseBreaker({ state: 'UNLOCKED', cooldownEndsAt: STARTED_AT, reflectionMinLength: 20 })?.cooldownEndsAt).toBeNull()
  })

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['an unknown state', { state: 'PAUSED', cooldownEndsAt: null, reflectionMinLength: 20 }],
    ['COOLDOWN without an end', { state: 'COOLDOWN', cooldownEndsAt: null, reflectionMinLength: 20 }],
    ['an unparsable end', { state: 'COOLDOWN', cooldownEndsAt: 'later', reflectionMinLength: 20 }],
    ['a zero minimum length', { state: 'LOCKED', cooldownEndsAt: null, reflectionMinLength: 0 }],
    ['a fractional minimum length', { state: 'LOCKED', cooldownEndsAt: null, reflectionMinLength: 2.5 }],
    ['a missing minimum length', { state: 'LOCKED', cooldownEndsAt: null }],
  ])('returns null for %s', (_, value) => {
    expect(parseBreaker(value)).toBeNull()
  })
})
