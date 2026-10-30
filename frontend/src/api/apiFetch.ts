import { ApiError } from './ApiError.ts'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ApiFetchOptions {
  method?: HttpMethod
  body?: unknown
  token?: string
  signal?: AbortSignal
  keepalive?: boolean
}

const NETWORK_ERROR_DETAIL = "Can't reach the server. Check your connection."
const FALLBACK_DETAIL = 'Something went wrong. Please try again.'
const UNREADABLE_DETAIL = "The server sent a response the app can't read."

// The only function in the app that calls fetch.
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  if (!path.startsWith('/api/')) {
    throw new Error(`apiFetch path must start with /api/: ${path}`)
  }

  const { method = 'GET', body, token, signal, keepalive } = options
  const headers: Record<string, string> = { Accept: 'application/json, application/problem+json' }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      keepalive,
    })
  } catch (error) {
    // A caller-initiated abort is not a network failure; let the caller see it unchanged.
    if (signal?.aborted) {
      throw error
    }
    throw new ApiError({ status: 0, title: 'Network error', detail: NETWORK_ERROR_DETAIL, fieldErrors: {} })
  }

  if (!response.ok) {
    throw await toApiError(response)
  }
  if (response.status === 204) {
    return undefined as T
  }

  try {
    return (await response.json()) as T
  } catch {
    throw new ApiError({
      status: response.status,
      title: 'Unreadable response',
      detail: UNREADABLE_DETAIL,
      fieldErrors: {},
    })
  }
}

function apiBaseUrl(): string {
  const value: unknown = import.meta.env.VITE_API_URL
  return typeof value === 'string' ? value.replace(/\/+$/, '') : ''
}

// Builds an ApiError from a Spring ProblemDetail body, falling back when the body is empty or not JSON.
async function toApiError(response: Response): Promise<ApiError> {
  const problem = asRecord(await readJson(response))
  const title = nonEmptyString(problem?.title) ?? (response.statusText || `HTTP ${response.status}`)
  const detail = nonEmptyString(problem?.detail) ?? FALLBACK_DETAIL

  return new ApiError({
    status: response.status,
    title,
    detail,
    fieldErrors: toFieldErrors(problem?.errors),
  })
}

async function readJson(response: Response): Promise<unknown> {
  try {
    const text = await response.text()
    return text ? JSON.parse(text) : undefined
  } catch {
    return undefined
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

function toFieldErrors(value: unknown): Record<string, string> {
  const errors = asRecord(value)
  const fieldErrors: Record<string, string> = {}
  if (!errors) {
    return fieldErrors
  }
  for (const [field, message] of Object.entries(errors)) {
    if (typeof message === 'string') {
      fieldErrors[field] = message
    }
  }
  return fieldErrors
}
