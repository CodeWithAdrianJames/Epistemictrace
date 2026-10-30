// The token lives in sessionStorage only (Q13): a refresh keeps it, closing the tab drops it.
const STORAGE_KEY = 'epistemictrace:token'

interface StoredToken {
  token: string
  expiresAt: string
}

// Returns the stored token, or null when it is absent, unreadable or past its expiresAt.
export function getToken(): string | null {
  const stored = readStoredToken()
  if (!stored) {
    return null
  }
  const expiresAtMs = Date.parse(stored.expiresAt)
  if (Number.isNaN(expiresAtMs) || expiresAtMs <= Date.now()) {
    clearToken()
    return null
  }
  return stored.token
}

// expiresAt is the ISO-8601 instant returned by POST /api/auth/login.
export function setToken(token: string, expiresAt: string): void {
  const stored: StoredToken = { token, expiresAt }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
}

export function clearToken(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}

function readStoredToken(): StoredToken | null {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (raw === null) {
    return null
  }
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    clearToken()
    return null
  }
  if (isStoredToken(value)) {
    return value
  }
  clearToken()
  return null
}

function isStoredToken(value: unknown): value is StoredToken {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  return typeof record.token === 'string' && record.token !== '' && typeof record.expiresAt === 'string'
}
