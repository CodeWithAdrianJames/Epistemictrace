import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './ApiError.ts'
import {
  addTestCase,
  archiveActivity,
  createActivity,
  deleteTestCase,
  getActivity,
  listActivities,
  listTestCases,
  publishActivity,
  updateActivity,
  updateTestCase,
} from './instructorActivitiesApi.ts'

const BASE_URL = 'http://api.test'
const TOKEN = 'token-1'

const fetchMock = vi.fn<typeof fetch>()

const SUMMARY = {
  id: 3,
  title: 'Sum two numbers',
  status: 'DRAFT',
  testCaseCount: 2,
  updatedAt: '2026-10-01T08:01:00Z',
}

const TEST_CASE = { id: 11, position: 1, input: '1 2\n', expectedOutput: '3', hidden: false }

const DETAIL = {
  id: 3,
  title: 'Sum two numbers',
  problemStatement: 'Read two numbers and print their sum.',
  starterCode: 'a, b = map(int, input().split())\n',
  status: 'PUBLISHED',
  testCases: [TEST_CASE, { id: 12, position: 2, input: '', expectedOutput: '0', hidden: true }],
  createdAt: '2026-10-01T08:00:00Z',
  updatedAt: '2026-10-01T08:01:00Z',
}

const ACTIVITY_REQUEST = {
  title: 'Sum two numbers',
  problemStatement: 'Read two numbers and print their sum.',
  starterCode: '',
}

const TEST_CASE_REQUEST = { input: '1 2\n', expectedOutput: '3', hidden: true }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function problemResponse(status: number, detail: string, errors?: Record<string, string>): Response {
  return new Response(JSON.stringify({ title: `HTTP ${status}`, status, detail, errors }), {
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

function sentBody(): unknown {
  const { init } = lastRequest()
  return init.body === undefined ? undefined : JSON.parse(String(init.body))
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
  it.each([
    ['listActivities', () => listActivities(TOKEN), 'GET', '/api/instructor/activities', [SUMMARY], 200],
    ['createActivity', () => createActivity(TOKEN, ACTIVITY_REQUEST), 'POST', '/api/instructor/activities', DETAIL, 201],
    ['getActivity', () => getActivity(TOKEN, 3), 'GET', '/api/instructor/activities/3', DETAIL, 200],
    ['updateActivity', () => updateActivity(TOKEN, 3, ACTIVITY_REQUEST), 'PUT', '/api/instructor/activities/3', DETAIL, 200],
    ['publishActivity', () => publishActivity(TOKEN, 3), 'POST', '/api/instructor/activities/3/publish', DETAIL, 200],
    ['archiveActivity', () => archiveActivity(TOKEN, 3), 'POST', '/api/instructor/activities/3/archive', DETAIL, 200],
    ['listTestCases', () => listTestCases(TOKEN, 3), 'GET', '/api/instructor/activities/3/test-cases', [TEST_CASE], 200],
    [
      'addTestCase',
      () => addTestCase(TOKEN, 3, TEST_CASE_REQUEST),
      'POST',
      '/api/instructor/activities/3/test-cases',
      TEST_CASE,
      201,
    ],
    [
      'updateTestCase',
      () => updateTestCase(TOKEN, 3, 11, TEST_CASE_REQUEST),
      'PUT',
      '/api/instructor/activities/3/test-cases/11',
      TEST_CASE,
      200,
    ],
  ])('%s sends %s %s with the bearer token', async (_name, call, method, path, body, status) => {
    fetchMock.mockResolvedValue(jsonResponse(body, status))

    await call()

    const { url, init, headers } = lastRequest()
    expect(url).toBe(`${BASE_URL}${path}`)
    expect(init.method).toBe(method)
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`)
  })

  it('deleteTestCase sends DELETE and resolves with no value on 204', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(deleteTestCase(TOKEN, 3, 11)).resolves.toBeUndefined()

    const { url, init, headers } = lastRequest()
    expect(url).toBe(`${BASE_URL}/api/instructor/activities/3/test-cases/11`)
    expect(init.method).toBe('DELETE')
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(init.body).toBeUndefined()
  })

  it.each([
    ['createActivity', () => createActivity(TOKEN, { ...ACTIVITY_REQUEST, extra: 'x' } as typeof ACTIVITY_REQUEST)],
    ['updateActivity', () => updateActivity(TOKEN, 3, { ...ACTIVITY_REQUEST, extra: 'x' } as typeof ACTIVITY_REQUEST)],
  ])('%s sends exactly title, problem statement and starter code', async (_name, call) => {
    fetchMock.mockResolvedValue(jsonResponse(DETAIL))

    await call()

    expect(sentBody()).toEqual(ACTIVITY_REQUEST)
  })

  it.each([
    ['addTestCase', () => addTestCase(TOKEN, 3, { ...TEST_CASE_REQUEST, position: 9 } as typeof TEST_CASE_REQUEST)],
    [
      'updateTestCase',
      () => updateTestCase(TOKEN, 3, 11, { ...TEST_CASE_REQUEST, position: 9 } as typeof TEST_CASE_REQUEST),
    ],
  ])('%s sends exactly input, expected output and hidden', async (_name, call) => {
    fetchMock.mockResolvedValue(jsonResponse(TEST_CASE))

    await call()

    expect(sentBody()).toEqual(TEST_CASE_REQUEST)
  })

  it.each([
    ['publishActivity', () => publishActivity(TOKEN, 3)],
    ['archiveActivity', () => archiveActivity(TOKEN, 3)],
  ])('%s sends no body', async (_name, call) => {
    fetchMock.mockResolvedValue(jsonResponse(DETAIL))

    await call()

    const { init, headers } = lastRequest()
    expect(init.body).toBeUndefined()
    expect(headers).not.toHaveProperty('Content-Type')
  })

  it.each([
    ['listActivities', (signal: AbortSignal) => listActivities(TOKEN, signal), [SUMMARY]],
    ['getActivity', (signal: AbortSignal) => getActivity(TOKEN, 3, signal), DETAIL],
    ['listTestCases', (signal: AbortSignal) => listTestCases(TOKEN, 3, signal), [TEST_CASE]],
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

  it.each([0, -1, 2.5])('rejects test case id %s without sending a request', async (id) => {
    await expect(deleteTestCase(TOKEN, 3, id)).rejects.toThrow('test case id')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('responses', () => {
  it('listActivities returns the summaries in server order', async () => {
    const second = { ...SUMMARY, id: 2, title: 'Older', status: 'ARCHIVED', updatedAt: '2026-09-01T08:00:00Z' }
    fetchMock.mockResolvedValue(jsonResponse([SUMMARY, second]))

    await expect(listActivities(TOKEN)).resolves.toEqual([SUMMARY, second])
  })

  it('listActivities returns an empty array for no activities', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))

    await expect(listActivities(TOKEN)).resolves.toEqual([])
  })

  it('getActivity returns the detail with test cases in server order', async () => {
    fetchMock.mockResolvedValue(jsonResponse(DETAIL))

    await expect(getActivity(TOKEN, 3)).resolves.toEqual(DETAIL)
  })

  it('createActivity returns the created detail', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...DETAIL, status: 'DRAFT', testCases: [] }, 201))

    await expect(createActivity(TOKEN, ACTIVITY_REQUEST)).resolves.toEqual({
      ...DETAIL,
      status: 'DRAFT',
      testCases: [],
    })
  })

  it('listTestCases and addTestCase return test cases', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([TEST_CASE]))
    await expect(listTestCases(TOKEN, 3)).resolves.toEqual([TEST_CASE])

    fetchMock.mockResolvedValueOnce(jsonResponse(TEST_CASE, 201))
    await expect(addTestCase(TOKEN, 3, TEST_CASE_REQUEST)).resolves.toEqual(TEST_CASE)
  })

  it('drops fields the app does not know', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ ...SUMMARY, instructorId: 1 }]))

    await expect(listActivities(TOKEN)).resolves.toEqual([SUMMARY])
  })

  it('drops unknown fields from nested test cases', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...DETAIL, testCases: [{ ...TEST_CASE, activityId: 3 }] }))

    const detail = await getActivity(TOKEN, 3)

    expect(detail.testCases).toEqual([TEST_CASE])
  })

  it.each([
    ['not an array', { activities: [] }],
    ['a null row', [null]],
    ['a missing id', [{ ...SUMMARY, id: undefined }]],
    ['a zero id', [{ ...SUMMARY, id: 0 }]],
    ['a string id', [{ ...SUMMARY, id: '3' }]],
    ['a non-string title', [{ ...SUMMARY, title: 5 }]],
    ['an unknown status', [{ ...SUMMARY, status: 'DELETED' }]],
    ['a lower-case status', [{ ...SUMMARY, status: 'draft' }]],
    ['a negative test case count', [{ ...SUMMARY, testCaseCount: -1 }]],
    ['a fractional test case count', [{ ...SUMMARY, testCaseCount: 1.5 }]],
    ['an unparsable updatedAt', [{ ...SUMMARY, updatedAt: 'yesterday' }]],
    ['a numeric updatedAt', [{ ...SUMMARY, updatedAt: 1759305660000 }]],
  ])('listActivities rejects a body with %s', async (_name, body) => {
    fetchMock.mockResolvedValue(jsonResponse(body))

    const error = await catchApiError(listActivities(TOKEN))

    expect(error.status).toBe(200)
    expect(error.title).toBe('Unreadable response')
    expect(error.detail).toBe("The server sent a response the app can't read.")
  })

  it.each([
    ['an array', [DETAIL]],
    ['a missing problem statement', { ...DETAIL, problemStatement: undefined }],
    ['a null starter code', { ...DETAIL, starterCode: null }],
    ['an unknown status', { ...DETAIL, status: 'LIVE' }],
    ['test cases that are not an array', { ...DETAIL, testCases: {} }],
    ['a test case with position 0', { ...DETAIL, testCases: [{ ...TEST_CASE, position: 0 }] }],
    ['a test case with a non-string input', { ...DETAIL, testCases: [{ ...TEST_CASE, input: null }] }],
    ['a test case with a non-string expected output', { ...DETAIL, testCases: [{ ...TEST_CASE, expectedOutput: 3 }] }],
    ['a test case with a non-boolean hidden', { ...DETAIL, testCases: [{ ...TEST_CASE, hidden: 'false' }] }],
    ['an unparsable createdAt', { ...DETAIL, createdAt: '' }],
  ])('getActivity rejects a body with %s', async (_name, body) => {
    fetchMock.mockResolvedValue(jsonResponse(body))

    const error = await catchApiError(getActivity(TOKEN, 3))

    expect(error.status).toBe(200)
    expect(error.title).toBe('Unreadable response')
  })

  it('addTestCase rejects an unreadable test case with the 201 status', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...TEST_CASE, id: -4 }, 201))

    const error = await catchApiError(addTestCase(TOKEN, 3, TEST_CASE_REQUEST))

    expect(error.status).toBe(201)
    expect(error.title).toBe('Unreadable response')
  })

  it('passes a 400 through with its field errors', async () => {
    fetchMock.mockResolvedValue(
      problemResponse(400, 'Invalid request content.', { title: 'must not be blank', starterCode: 'size must be between 0 and 20000' }),
    )

    const error = await catchApiError(createActivity(TOKEN, ACTIVITY_REQUEST))

    expect(error.status).toBe(400)
    expect(error.fieldErrors).toEqual({
      title: 'must not be blank',
      starterCode: 'size must be between 0 and 20000',
    })
  })

  it.each([
    ['publishActivity', () => publishActivity(TOKEN, 3), 409, 'Add at least one test case before publishing.'],
    ['updateActivity', () => updateActivity(TOKEN, 3, ACTIVITY_REQUEST), 409, "Archived activities can't be changed."],
    ['getActivity', () => getActivity(TOKEN, 3), 403, "You don't have access to this."],
    ['getActivity', () => getActivity(TOKEN, 99), 404, 'Activity not found.'],
    ['deleteTestCase', () => deleteTestCase(TOKEN, 3, 11), 409, 'A published activity needs at least one test case.'],
  ])('%s passes a %s through with the server detail', async (_name, call, status, detail) => {
    fetchMock.mockResolvedValue(problemResponse(status, detail))

    const error = await catchApiError(call())

    expect(error.status).toBe(status)
    expect(error.detail).toBe(detail)
  })

  it('passes a 401 through so the caller can log out', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }))

    const error = await catchApiError(listActivities(TOKEN))

    expect(error.status).toBe(401)
  })
})
