import { apiFetch } from './apiFetch.ts'
import { asRecord, isInstant, unreadable } from './responseParsing.ts'

// Body of 200 from PUT /api/me/consent; consentAcceptedAt is an ISO-8601 instant.
export interface ConsentResult {
  consentAcceptedAt: string
}

// Spec 15 R1: no body. The server keeps the first timestamp when consent was already recorded.
export async function putConsent(token: string, signal?: AbortSignal): Promise<ConsentResult> {
  const body = await apiFetch<unknown>('/api/me/consent', { method: 'PUT', token, signal })
  return parseConsentResult(body, 200)
}

function parseConsentResult(value: unknown, status: number): ConsentResult {
  const record = asRecord(value)
  if (record && isInstant(record.consentAcceptedAt)) {
    return { consentAcceptedAt: record.consentAcceptedAt }
  }
  throw unreadable(status)
}
