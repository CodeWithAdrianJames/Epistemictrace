import { apiFetch } from './apiFetch.ts'
import { asRecord, isCount, isId, isInstant, unreadable } from './responseParsing.ts'

// One row of GET /api/me/sessions (spec 26 R1). Never an SDI value.
export interface HistoryItem {
  sessionId: number
  activityId: number
  activityTitle: string
  startedAt: string
  endedAt: string | null
  // null while the session has no end.
  durationSeconds: number | null
  runCount: number
  reflectionCount: number
}

export interface HistoryPage {
  items: HistoryItem[]
  page: number
  size: number
  totalItems: number
}

export interface HistoryReflection {
  hypothesis: string
  plannedFix: string
  submittedAt: string
}

// GET /api/me/sessions/{id} (spec 26 R2).
export interface SessionDetail extends HistoryItem {
  reflections: HistoryReflection[]
}

// Spec 27 R1. The server pages with size 20 by default; the client keeps that size.
export async function listSessions(token: string, page: number, signal?: AbortSignal): Promise<HistoryPage> {
  const body = await apiFetch<unknown>(`/api/me/sessions?page=${page}`, { token, signal })
  return parseHistoryPage(body)
}

export async function getSession(token: string, sessionId: number, signal?: AbortSignal): Promise<SessionDetail> {
  const body = await apiFetch<unknown>(`/api/me/sessions/${sessionId}`, { token, signal })
  const record = asRecord(body)
  const item = parseItem(record)
  if (record && item && Array.isArray(record.reflections)) {
    const reflections = record.reflections.map(parseReflection)
    if (reflections.every((reflection) => reflection !== null)) {
      return { ...item, reflections }
    }
  }
  throw unreadable(200)
}

function parseHistoryPage(value: unknown): HistoryPage {
  const record = asRecord(value)
  if (record && Array.isArray(record.items) && isCount(record.page) && isCount(record.size) && isCount(record.totalItems)) {
    const items = record.items.map((item) => parseItem(asRecord(item)))
    if (items.every((item) => item !== null)) {
      return { items, page: record.page, size: record.size, totalItems: record.totalItems }
    }
  }
  throw unreadable(200)
}

// Keeps only the known fields, so nothing else the server might add reaches the page.
function parseItem(record: Record<string, unknown> | undefined): HistoryItem | null {
  if (
    record &&
    isId(record.sessionId) &&
    isId(record.activityId) &&
    typeof record.activityTitle === 'string' &&
    isInstant(record.startedAt) &&
    (record.endedAt === null || isInstant(record.endedAt)) &&
    (record.durationSeconds === null || isCount(record.durationSeconds)) &&
    isCount(record.runCount) &&
    isCount(record.reflectionCount)
  ) {
    return {
      sessionId: record.sessionId,
      activityId: record.activityId,
      activityTitle: record.activityTitle,
      startedAt: record.startedAt,
      endedAt: record.endedAt,
      durationSeconds: record.durationSeconds,
      runCount: record.runCount,
      reflectionCount: record.reflectionCount,
    }
  }
  return null
}

function parseReflection(value: unknown): HistoryReflection | null {
  const record = asRecord(value)
  if (
    record &&
    typeof record.hypothesis === 'string' &&
    typeof record.plannedFix === 'string' &&
    isInstant(record.submittedAt)
  ) {
    return { hypothesis: record.hypothesis, plannedFix: record.plannedFix, submittedAt: record.submittedAt }
  }
  return null
}
