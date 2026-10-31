import { apiFetch } from './apiFetch.ts'
import { asRecord, isCount, isId, isInstant, unreadable } from './responseParsing.ts'

// Spec 10 R1: the student activity endpoints. Each call takes the caller's token (spec 07 R4 style).

export type ActivityStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

// One row of GET /api/activities (published activities only); updatedAt is an ISO-8601 instant.
export interface ActivitySummary {
  id: number
  title: string
  status: ActivityStatus
  testCaseCount: number
  updatedAt: string
}

export interface TestCase {
  id: number
  position: number
  input: string
  expectedOutput: string
  hidden: boolean
}

// Test cases arrive in position order, hidden ones included (spec 08 R4); createdAt/updatedAt are ISO-8601 instants.
export interface ActivityDetail {
  id: number
  title: string
  problemStatement: string
  starterCode: string
  status: ActivityStatus
  testCases: TestCase[]
  createdAt: string
  updatedAt: string
}

const BASE_PATH = '/api/activities'

export async function listActivities(token: string, signal?: AbortSignal): Promise<ActivitySummary[]> {
  const body = await apiFetch<unknown>(BASE_PATH, { token, signal })
  return parseList(body, 200, parseSummary)
}

export async function getActivity(token: string, activityId: number, signal?: AbortSignal): Promise<ActivityDetail> {
  const body = await apiFetch<unknown>(activityPath(activityId), { token, signal })
  return parseDetail(body, 200)
}

// The id comes from a route param or an earlier response; a bad one is a programming error, not a request to send.
function activityPath(activityId: number): string {
  if (!isId(activityId)) {
    throw new Error(`Invalid activity id: ${activityId}`)
  }
  return `${BASE_PATH}/${activityId}`
}

function parseList<T>(value: unknown, status: number, parseItem: (item: unknown, status: number) => T): T[] {
  if (!Array.isArray(value)) {
    throw unreadable(status)
  }
  return value.map((item: unknown) => parseItem(item, status))
}

function parseSummary(value: unknown, status: number): ActivitySummary {
  const record = asRecord(value)
  if (
    record &&
    isId(record.id) &&
    typeof record.title === 'string' &&
    isStatus(record.status) &&
    isCount(record.testCaseCount) &&
    isInstant(record.updatedAt)
  ) {
    return {
      id: record.id,
      title: record.title,
      status: record.status,
      testCaseCount: record.testCaseCount,
      updatedAt: record.updatedAt,
    }
  }
  throw unreadable(status)
}

function parseDetail(value: unknown, status: number): ActivityDetail {
  const record = asRecord(value)
  if (
    record &&
    isId(record.id) &&
    typeof record.title === 'string' &&
    typeof record.problemStatement === 'string' &&
    typeof record.starterCode === 'string' &&
    isStatus(record.status) &&
    isInstant(record.createdAt) &&
    isInstant(record.updatedAt)
  ) {
    return {
      id: record.id,
      title: record.title,
      problemStatement: record.problemStatement,
      starterCode: record.starterCode,
      status: record.status,
      testCases: parseList(record.testCases, status, parseTestCase),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }
  throw unreadable(status)
}

function parseTestCase(value: unknown, status: number): TestCase {
  const record = asRecord(value)
  if (
    record &&
    isId(record.id) &&
    isId(record.position) &&
    typeof record.input === 'string' &&
    typeof record.expectedOutput === 'string' &&
    typeof record.hidden === 'boolean'
  ) {
    return {
      id: record.id,
      position: record.position,
      input: record.input,
      expectedOutput: record.expectedOutput,
      hidden: record.hidden,
    }
  }
  throw unreadable(status)
}

function isStatus(value: unknown): value is ActivityStatus {
  return value === 'DRAFT' || value === 'PUBLISHED' || value === 'ARCHIVED'
}
