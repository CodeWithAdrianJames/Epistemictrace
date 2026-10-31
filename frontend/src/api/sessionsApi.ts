import { apiFetch } from './apiFetch.ts'
import { asRecord, isCount, isId, isInstant, unreadable } from './responseParsing.ts'

// Body of POST /api/sessions (spec 16). Open object: specs 22 and 23 add the breaker state.
export interface SessionStart extends Record<string, unknown> {
  sessionId: number
  activityId: number
  startedAt: string
  resumed: boolean
}

// Body of POST /api/sessions/{id}/events (spec 18 R6). Open object: specs 21 and 22 add the
// struggle level and the breaker state.
export interface BatchResponse extends Record<string, unknown> {
  accepted: number
  duplicates: number
}

// Event payloads exactly as spec 18 R1; the server rejects any other field, sdiValue included.
export interface EditEvent {
  clientEventId: string
  type: 'EDIT'
  occurredAt: string
  charsAdded: number
  charsRemoved: number
}

export interface RunEvent {
  clientEventId: string
  type: 'RUN'
  occurredAt: string
  passedCount: number
  totalCount: number
}

export interface ErrorEvent {
  clientEventId: string
  type: 'ERROR'
  occurredAt: string
  errorSignature: string
}

export type TelemetryEvent = EditEvent | RunEvent | ErrorEvent

export interface KeepaliveOption {
  keepalive?: boolean
}

// Spec 17 R1. A 201 (new) and a 200 (resumed) have the same body.
export async function startSession(token: string, activityId: number, signal?: AbortSignal): Promise<SessionStart> {
  const body = await apiFetch<unknown>('/api/sessions', { method: 'POST', body: { activityId }, token, signal })
  return parseSessionStart(body)
}

// keepalive lets the request outlive the page (pagehide, unmount on navigation).
export async function endSession(token: string, sessionId: number, { keepalive }: KeepaliveOption = {}): Promise<void> {
  await apiFetch<unknown>(`/api/sessions/${sessionId}/end`, { method: 'POST', token, keepalive })
}

export async function sendEvents(
  token: string,
  sessionId: number,
  events: readonly TelemetryEvent[],
  { keepalive }: KeepaliveOption = {},
): Promise<BatchResponse> {
  const body = await apiFetch<unknown>(`/api/sessions/${sessionId}/events`, {
    method: 'POST',
    body: { events },
    token,
    keepalive,
  })
  return parseBatchResponse(body)
}

function parseSessionStart(value: unknown): SessionStart {
  const record = asRecord(value)
  if (
    record &&
    isId(record.sessionId) &&
    isId(record.activityId) &&
    isInstant(record.startedAt) &&
    typeof record.resumed === 'boolean'
  ) {
    return {
      ...record,
      sessionId: record.sessionId,
      activityId: record.activityId,
      startedAt: record.startedAt,
      resumed: record.resumed,
    }
  }
  throw unreadable(200)
}

function parseBatchResponse(value: unknown): BatchResponse {
  const record = asRecord(value)
  if (record && isCount(record.accepted) && isCount(record.duplicates)) {
    return { ...record, accepted: record.accepted, duplicates: record.duplicates }
  }
  throw unreadable(200)
}
