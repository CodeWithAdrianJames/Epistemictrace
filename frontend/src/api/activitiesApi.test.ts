import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './ApiError.ts'
import { getActivity, listActivities } from './activitiesApi.ts'

const BASE_URL = 'http://api.test'
const TOKEN = 'token-1'

const fetchMock = vi.fn<typeof fetch>()

const SUMMARY = {
  id: 3,
  title: 'Sum two numbers',
  status: 'PUBLISHED',
  testCaseCount: 2,
  updatedAt: '2026-10-01T08:01:00Z',
}

const TEST_CASE = { id: 11, position: 1, input: '1 2\n', expectedOutput: '3', hidden: false }
const HIDDEN_TEST_CASE = { id: 12, position: 2, input: '', expectedOutput: '0', hidden: true }

const DETAIL = {
  id: 3,
  title: 'Sum two numbers',
  problemStatement: 'Read two numbers and print their sum.',
  starterCode: 'a, b = map(int, input().split())\n',
  status: 'PUBLISHED',
  testCases: [TEST_CASE, HIDDEN_TEST_CASE],
  createdAt: '2026-10-01T08:00:00Z',
  updatedAt: '2026-10-01T08:01:00Z',
}

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
  throw new Error('expected an ApiError')
}

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', BASE_URL)
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('requests', () => {
  it('listActivities sends GET /api/activities with the bearer token', async () => {
    fetchMock.mockResolvedValue(jsonResponse([SUMMARY]))

    await listActivities(TOKEN)

    const { url, init, headers } = lastRequest()
    expect(url).toBe(`${BASE_URL}/api/activities`)
    expect(init.method).toBe('GET')
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`)
  })

  it('getActivity sends GET /api/activities/{id} with the bearer token', async () => {
    fetchMock.mockResolvedValue(jsonResponse(DETAIL))

    await getActivity(TOKEN, 3)

    const { url, headers } = lastRequest()
    expect(url).toBe(`${BASE_URL}/api/activities/3`)
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`)
  })

  it.each([
    ['listActivities', (signal: AbortSignal) => listActivities(TOKEN, signal), [SUMMARY]],
    ['getActivity', (signal: AbortSignal) => getActivity(TOKEN, 3, signal), DETAIL],
  ])('%s passes the abort signal to fetch', async (_name, call, body) => {
    fetchMock.mockResolvedValue(jsonResponse(body))
    const controller = new AbortController()

    await call(controller.signal)

    expect(lastRequest().init.signal).toBe(controller.signal)
  })

  it.each([0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])(
    'rejects activity id %s without sending a request',
    async (id) => {
      await expect(getActivity(TOKEN, id)).rejects.toThrow('activity id')
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )
})

describe('responses', () => {
  it('listActivities returns the summaries in server order', async () => {
    const second = { ...SUMMARY, id: 2, title: 'FizzBuzz', updatedAt: '2026-09-01T08:00:00Z' }
    fetchMock.mockResolvedValue(jsonResponse([SUMMARY, second]))

    await expect(listActivities(TOKEN)).resolves.toEqual([SUMMARY, second])
  })

  it('listActivities returns an empty array for no activities', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))

    await expect(listActivities(TOKEN)).resolves.toEqual([])
  })

  it('getActivity returns the detail with every test case, hidden ones included', async () => {
    fetchMock.mockResolvedValue(jsonResponse(DETAIL))

    await expect(getActivity(TOKEN, 3)).resolves.toEqual(DETAIL)
  })

  it('drops fields the app does not know', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ ...SUMMARY, extra: 'x' }]))

    await expect(listActivities(TOKEN)).resolves.toEqual([SUMMARY])
  })

  it.each([
    [undefined],
    [{ id: 3 }],
    [{ ...SUMMARY, id: 'x' }],
    [{ ...SUMMARY, status: 'UNKNOWN' }],
    [{ ...SUMMARY, testCaseCount: -1 }],
    [{ ...SUMMARY, updatedAt: 'not a date' }],
  ])('rejects a malformed summary %#', async (bad) => {
    fetchMock.mockResolvedValue(jsonResponse([bad]))

    const error = await catchApiError(listActivities(TOKEN))

    expect(error.status).toBe(200)
    expect(error.title).toBe('Unreadable response')
  })

  it('rejects a malformed detail body', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...DETAIL, testCases: 'nope' }))

    const error = await catchApiError(getActivity(TOKEN, 3))

    expect(error.status).toBe(200)
    expect(error.title).toBe('Unreadable response')
  })

  it('passes a 404 ApiError through unchanged', async () => {
    fetchMock.mockResolvedValue(problemResponse(404, 'Activity not found.'))

    const error = await catchApiError(getActivity(TOKEN, 3))

    expect(error.status).toBe(404)
    expect(error.detail).toBe('Activity not found.')
  })

  it('passes a 401 ApiError through unchanged', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }))

    const error = await catchApiError(listActivities(TOKEN))

    expect(error.status).toBe(401)
  })
})
