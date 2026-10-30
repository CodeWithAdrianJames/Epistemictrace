import { ApiError } from './ApiError.ts'
import { apiFetch } from './apiFetch.ts'

export type Role = 'STUDENT' | 'INSTRUCTOR'

export interface User {
  id: number
  name: string
  email: string
  role: Role
  consentAccepted: boolean
}

// Body of 201 from POST /api/auth/register.
export interface RegisteredUser {
  id: number
  name: string
  email: string
  role: Role
}

// Body of 200 from POST /api/auth/login; expiresAt is an ISO-8601 instant.
export interface LoginResult {
  token: string
  expiresAt: string
  user: User
}

const UNREADABLE_DETAIL = "The server sent a response the app can't read."

export async function register(name: string, email: string, password: string): Promise<RegisteredUser> {
  const body = await apiFetch<unknown>('/api/auth/register', {
    method: 'POST',
    body: { name, email, password },
  })
  return parseRegisteredUser(body, 201)
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const body = await apiFetch<unknown>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  })
  return parseLoginResult(body, 200)
}

export async function me(token: string, signal?: AbortSignal): Promise<User> {
  const body = await apiFetch<unknown>('/api/auth/me', { token, signal })
  return parseUser(body, 200)
}

function parseRegisteredUser(value: unknown, status: number): RegisteredUser {
  const record = asRecord(value)
  if (
    record &&
    isId(record.id) &&
    typeof record.name === 'string' &&
    typeof record.email === 'string' &&
    isRole(record.role)
  ) {
    return { id: record.id, name: record.name, email: record.email, role: record.role }
  }
  throw unreadable(status)
}

function parseLoginResult(value: unknown, status: number): LoginResult {
  const record = asRecord(value)
  if (
    record &&
    typeof record.token === 'string' &&
    record.token !== '' &&
    typeof record.expiresAt === 'string' &&
    !Number.isNaN(Date.parse(record.expiresAt))
  ) {
    return { token: record.token, expiresAt: record.expiresAt, user: parseUser(record.user, status) }
  }
  throw unreadable(status)
}

function parseUser(value: unknown, status: number): User {
  const record = asRecord(value)
  if (
    record &&
    isId(record.id) &&
    typeof record.name === 'string' &&
    typeof record.email === 'string' &&
    isRole(record.role) &&
    typeof record.consentAccepted === 'boolean'
  ) {
    return {
      id: record.id,
      name: record.name,
      email: record.email,
      role: record.role,
      consentAccepted: record.consentAccepted,
    }
  }
  throw unreadable(status)
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function isId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isRole(value: unknown): value is Role {
  return value === 'STUDENT' || value === 'INSTRUCTOR'
}

// Same shape apiFetch uses for an unreadable 2xx body, so callers only ever handle ApiError.
function unreadable(status: number): ApiError {
  return new ApiError({ status, title: 'Unreadable response', detail: UNREADABLE_DETAIL, fieldErrors: {} })
}
