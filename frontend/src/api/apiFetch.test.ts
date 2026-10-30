import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './ApiError.ts'
import { apiFetch } from './apiFetch.ts'

const BASE_URL = 'http://api.test'

const fetchMock = vi.fn<typeof fetch>()

function jsonResponse(body: unknown, status = 200, contentType = 'application/json'): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': contentType } })
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

describe('apiFetch', () => {
  it('resolves the JSON body of a successful response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'ok' }))

    await expect(apiFetch<{ status: string }>('/api/health')).resolves.toEqual({ status: 'ok' })

    const { url, init, headers } = lastRequest()
    expect(url).toBe('http://api.test/api/health')
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
    expect(headers.Accept).toBe('application/json, application/problem+json')
    expect(headers).not.toHaveProperty('Content-Type')
  })

  it('sends the body as JSON with the given method', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 1 }, 201))

    await expect(apiFetch('/api/activities', { method: 'POST', body: { title: 'Loops' } })).resolves.toEqual({ id: 1 })

    const { init, headers } = lastRequest()
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"title":"Loops"}')
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('passes signal and keepalive through to fetch', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    const controller = new AbortController()

    await apiFetch('/api/sessions/1/events', { method: 'POST', body: [], signal: controller.signal, keepalive: true })

    const { init } = lastRequest()
    expect(init.signal).toBe(controller.signal)
    expect(init.keepalive).toBe(true)
  })

  it('ignores a trailing slash on VITE_API_URL', async () => {
    vi.stubEnv('VITE_API_URL', 'http://api.test/')
    fetchMock.mockResolvedValue(jsonResponse({}))

    await apiFetch('/api/health')

    expect(lastRequest().url).toBe('http://api.test/api/health')
  })

  it('resolves to undefined for 204 No Content', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(apiFetch<void>('/api/auth/logout', { method: 'POST' })).resolves.toBeUndefined()
  })

  it('sets the Authorization header only when a token is passed', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({}))

    await apiFetch('/api/auth/me', { token: 'test-token' })
    expect(lastRequest().headers.Authorization).toBe('Bearer test-token')

    await apiFetch('/api/auth/me')
    expect(lastRequest().headers).not.toHaveProperty('Authorization')
  })

  it('maps a ProblemDetail with errors to ApiError.fieldErrors', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          type: 'about:blank',
          title: 'Bad Request',
          status: 400,
          detail: 'Some fields are invalid.',
          errors: { email: 'must be a well-formed email address', password: 'size must be between 8 and 100', code: 3 },
        },
        400,
        'application/problem+json',
      ),
    )

    const error = await catchApiError(apiFetch('/api/auth/register', { method: 'POST', body: {} }))

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('ApiError')
    expect(error.status).toBe(400)
    expect(error.title).toBe('Bad Request')
    expect(error.detail).toBe('Some fields are invalid.')
    expect(error.message).toBe('Some fields are invalid.')
    expect(error.fieldErrors).toEqual({
      email: 'must be a well-formed email address',
      password: 'size must be between 8 and 100',
    })
  })

  it('maps a ProblemDetail without errors to empty fieldErrors', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ title: 'Not Found', status: 404, detail: 'Activity 9 was not found.' }, 404, 'application/problem+json'),
    )

    const error = await catchApiError(apiFetch('/api/activities/9'))

    expect(error.status).toBe(404)
    expect(error.title).toBe('Not Found')
    expect(error.detail).toBe('Activity 9 was not found.')
    expect(error.fieldErrors).toEqual({})
  })

  it('falls back safely when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html><body>Bad Gateway</body></html>', {
        status: 502,
        statusText: 'Bad Gateway',
        headers: { 'Content-Type': 'text/html' },
      }),
    )

    const error = await catchApiError(apiFetch('/api/activities'))

    expect(error.status).toBe(502)
    expect(error.title).toBe('Bad Gateway')
    expect(error.detail).toBe('Something went wrong. Please try again.')
    expect(error.fieldErrors).toEqual({})
  })

  it('falls back safely when the error body is empty', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }))

    const error = await catchApiError(apiFetch('/api/auth/me'))

    expect(error.status).toBe(401)
    expect(error.title).toBe('HTTP 401')
    expect(error.detail).toBe('Something went wrong. Please try again.')
    expect(error.fieldErrors).toEqual({})
  })

  it('falls back safely when the error body is JSON but not an object', async () => {
    fetchMock.mockResolvedValue(jsonResponse(['unexpected'], 500))

    const error = await catchApiError(apiFetch('/api/activities'))

    expect(error.status).toBe(500)
    expect(error.title).toBe('HTTP 500')
    expect(error.detail).toBe('Something went wrong. Please try again.')
    expect(error.fieldErrors).toEqual({})
  })

  it('throws ApiError when a successful response is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('not json', { status: 200 }))

    const error = await catchApiError(apiFetch('/api/health'))

    expect(error.status).toBe(200)
    expect(error.detail).toBe("The server sent a response the app can't read.")
  })

  it('throws ApiError with status 0 on a network failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const error = await catchApiError(apiFetch('/api/health'))

    expect(error.status).toBe(0)
    expect(error.detail).toBe("Can't reach the server. Check your connection.")
    expect(error.fieldErrors).toEqual({})
  })

  it('rethrows an abort from the caller unchanged', async () => {
    const controller = new AbortController()
    controller.abort()
    const abortError = new DOMException('The operation was aborted.', 'AbortError')
    fetchMock.mockRejectedValue(abortError)

    await expect(apiFetch('/api/health', { signal: controller.signal })).rejects.toBe(abortError)
  })

  it('rejects a path outside /api/ without calling fetch', async () => {
    await expect(apiFetch('/health')).rejects.toThrow('apiFetch path must start with /api/: /health')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
