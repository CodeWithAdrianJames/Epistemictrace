import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './ApiError.ts'
import { login, me, register } from './authApi.ts'

const BASE_URL = 'http://api.test'

const fetchMock = vi.fn<typeof fetch>()

const STUDENT = {
  id: 7,
  name: 'Student One',
  email: 'student1@example.test',
  role: 'STUDENT',
  consentAccepted: false,
}

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

describe('register', () => {
  it('posts name, email and password and returns the created user', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ id: 7, name: 'Student One', email: 'student1@example.test', role: 'STUDENT' }, 201),
    )

    await expect(register('Student One', 'student1@example.test', 'password123')).resolves.toEqual({
      id: 7,
      name: 'Student One',
      email: 'student1@example.test',
      role: 'STUDENT',
    })

    const { url, init, headers } = lastRequest()
    expect(url).toBe('http://api.test/api/auth/register')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({
      name: 'Student One',
      email: 'student1@example.test',
      password: 'password123',
    })
    expect(headers).not.toHaveProperty('Authorization')
  })

  it('passes a 409 through as an ApiError with the server message', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { title: 'Conflict', status: 409, detail: 'An account with this email already exists.' },
        409,
        'application/problem+json',
      ),
    )

    const error = await catchApiError(register('Student One', 'student1@example.test', 'password123'))

    expect(error.status).toBe(409)
    expect(error.detail).toBe('An account with this email already exists.')
  })

  it('passes field errors from a 400 through', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { title: 'Bad Request', status: 400, detail: 'Invalid request', errors: { password: 'size must be between 8 and 72' } },
        400,
        'application/problem+json',
      ),
    )

    const error = await catchApiError(register('Student One', 'student1@example.test', 'short'))

    expect(error.status).toBe(400)
    expect(error.fieldErrors).toEqual({ password: 'size must be between 8 and 72' })
  })

  it('rejects a 201 body without a valid role', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ id: 7, name: 'Student One', email: 'student1@example.test', role: 'ADMIN' }, 201),
    )

    const error = await catchApiError(register('Student One', 'student1@example.test', 'password123'))

    expect(error.status).toBe(201)
    expect(error.detail).toBe("The server sent a response the app can't read.")
  })
})

describe('login', () => {
  it('posts email and password and returns token, expiresAt and user', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ token: 'header.payload.signature', expiresAt: '2026-10-30T20:00:00Z', user: STUDENT }),
    )

    await expect(login('student1@example.test', 'password123')).resolves.toEqual({
      token: 'header.payload.signature',
      expiresAt: '2026-10-30T20:00:00Z',
      user: STUDENT,
    })

    const { url, init, headers } = lastRequest()
    expect(url).toBe('http://api.test/api/auth/login')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ email: 'student1@example.test', password: 'password123' })
    expect(headers).not.toHaveProperty('Authorization')
  })

  it('drops fields the client does not know', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        token: 'header.payload.signature',
        expiresAt: '2026-10-30T20:00:00Z',
        user: { ...STUDENT, passwordHash: 'never-used' },
        extra: true,
      }),
    )

    const result = await login('student1@example.test', 'password123')

    expect(result).toEqual({ token: 'header.payload.signature', expiresAt: '2026-10-30T20:00:00Z', user: STUDENT })
  })

  it('passes a 401 through as an ApiError', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { title: 'Unauthorized', status: 401, detail: 'Email or password is incorrect.' },
        401,
        'application/problem+json',
      ),
    )

    const error = await catchApiError(login('student1@example.test', 'wrong-password'))

    expect(error.status).toBe(401)
    expect(error.detail).toBe('Email or password is incorrect.')
  })

  it.each([
    ['token is missing', { expiresAt: '2026-10-30T20:00:00Z', user: STUDENT }],
    ['token is empty', { token: '', expiresAt: '2026-10-30T20:00:00Z', user: STUDENT }],
    ['expiresAt is not a date', { token: 'header.payload.signature', expiresAt: 'soon', user: STUDENT }],
    ['expiresAt is a number', { token: 'header.payload.signature', expiresAt: 1793390400, user: STUDENT }],
    ['user is missing', { token: 'header.payload.signature', expiresAt: '2026-10-30T20:00:00Z' }],
    [
      'user.consentAccepted is missing',
      {
        token: 'header.payload.signature',
        expiresAt: '2026-10-30T20:00:00Z',
        user: { id: 7, name: 'Student One', email: 'student1@example.test', role: 'STUDENT' },
      },
    ],
  ])('rejects a 200 body where %s', async (_label, body) => {
    fetchMock.mockResolvedValue(jsonResponse(body))

    const error = await catchApiError(login('student1@example.test', 'password123'))

    expect(error.status).toBe(200)
    expect(error.title).toBe('Unreadable response')
  })
})

describe('me', () => {
  it('sends the token as a bearer header and returns the user', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...STUDENT, role: 'INSTRUCTOR', consentAccepted: true }))

    await expect(me('header.payload.signature')).resolves.toEqual({
      ...STUDENT,
      role: 'INSTRUCTOR',
      consentAccepted: true,
    })

    const { url, init, headers } = lastRequest()
    expect(url).toBe('http://api.test/api/auth/me')
    expect(init.method).toBe('GET')
    expect(headers.Authorization).toBe('Bearer header.payload.signature')
  })

  it('passes the abort signal to fetch', async () => {
    fetchMock.mockResolvedValue(jsonResponse(STUDENT))
    const controller = new AbortController()

    await me('header.payload.signature', controller.signal)

    expect(lastRequest().init.signal).toBe(controller.signal)
  })

  it('passes a 401 through as an ApiError', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }))

    const error = await catchApiError(me('expired.token.value'))

    expect(error.status).toBe(401)
  })

  it.each([
    ['an array', [STUDENT]],
    ['an id that is a string', { ...STUDENT, id: '7' }],
    ['a lower-case role', { ...STUDENT, role: 'student' }],
    ['a missing email', { id: 7, name: 'Student One', role: 'STUDENT', consentAccepted: false }],
  ])('rejects a body with %s', async (_label, body) => {
    fetchMock.mockResolvedValue(jsonResponse(body))

    const error = await catchApiError(me('header.payload.signature'))

    expect(error.status).toBe(200)
    expect(error.detail).toBe("The server sent a response the app can't read.")
  })
})
