import { ApiError } from './ApiError.ts'

// Helpers the resource modules share to check 2xx bodies before the rest of the app trusts them.

const UNREADABLE_DETAIL = "The server sent a response the app can't read."

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

export function isId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

export function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

// ISO-8601 instants from java.time.Instant.
export function isInstant(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

// Same shape apiFetch uses for an unreadable 2xx body, so callers only ever handle ApiError.
export function unreadable(status: number): ApiError {
  return new ApiError({ status, title: 'Unreadable response', detail: UNREADABLE_DETAIL, fieldErrors: {} })
}
