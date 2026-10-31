import { apiFetch } from './apiFetch.ts'
import { asRecord, isCount, isId, isInstant, unreadable } from './responseParsing.ts'

// Spec 08 R3: the instructor activity endpoints. Every call takes the caller's token (spec 07 R4 style).

export type ActivityStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

// One row of GET /api/instructor/activities; updatedAt is an ISO-8601 instant.
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

// Test cases arrive in position order; createdAt and updatedAt are ISO-8601 instants.
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

export interface ActivityRequest {
  title: string
  problemStatement: string
  starterCode: string
}

export interface TestCaseRequest {
  input: string
  expectedOutput: string
  hidden: boolean
}

const BASE_PATH = '/api/instructor/activities'

export async function listActivities(token: string, signal?: AbortSignal): Promise<ActivitySummary[]> {
  const body = await apiFetch<unknown>(BASE_PATH, { token, signal })
  return parseList(body, 200, parseSummary)
}

export async function createActivity(token: string, request: ActivityRequest): Promise<ActivityDetail> {
  const body = await apiFetch<unknown>(BASE_PATH, { method: 'POST', token, body: activityBody(request) })
  return parseDetail(body, 201)
}

export async function getActivity(token: string, activityId: number, signal?: AbortSignal): Promise<ActivityDetail> {
  const body = await apiFetch<unknown>(activityPath(activityId), { token, signal })
  return parseDetail(body, 200)
}

export async function updateActivity(
  token: string,
  activityId: number,
  request: ActivityRequest,
): Promise<ActivityDetail> {
  const body = await apiFetch<unknown>(activityPath(activityId), {
    method: 'PUT',
    token,
    body: activityBody(request),
  })
  return parseDetail(body, 200)
}

export async function publishActivity(token: string, activityId: number): Promise<ActivityDetail> {
  const body = await apiFetch<unknown>(`${activityPath(activityId)}/publish`, { method: 'POST', token })
  return parseDetail(body, 200)
}

export async function archiveActivity(token: string, activityId: number): Promise<ActivityDetail> {
  const body = await apiFetch<unknown>(`${activityPath(activityId)}/archive`, { method: 'POST', token })
  return parseDetail(body, 200)
}

export async function listTestCases(token: string, activityId: number, signal?: AbortSignal): Promise<TestCase[]> {
  const body = await apiFetch<unknown>(testCasesPath(activityId), { token, signal })
  return parseList(body, 200, parseTestCase)
}

export async function addTestCase(token: string, activityId: number, request: TestCaseRequest): Promise<TestCase> {
  const body = await apiFetch<unknown>(testCasesPath(activityId), {
    method: 'POST',
    token,
    body: testCaseBody(request),
  })
  return parseTestCase(body, 201)
}

export async function updateTestCase(
  token: string,
  activityId: number,
  testCaseId: number,
  request: TestCaseRequest,
): Promise<TestCase> {
  const body = await apiFetch<unknown>(testCasePath(activityId, testCaseId), {
    method: 'PUT',
    token,
    body: testCaseBody(request),
  })
  return parseTestCase(body, 200)
}

export async function deleteTestCase(token: string, activityId: number, testCaseId: number): Promise<void> {
  await apiFetch<undefined>(testCasePath(activityId, testCaseId), { method: 'DELETE', token })
}

// Ids come from route params and earlier responses; a bad one is a programming error, not a request to send.
function activityPath(activityId: number): string {
  if (!isId(activityId)) {
    throw new Error(`Invalid activity id: ${activityId}`)
  }
  return `${BASE_PATH}/${activityId}`
}

function testCasesPath(activityId: number): string {
  return `${activityPath(activityId)}/test-cases`
}

function testCasePath(activityId: number, testCaseId: number): string {
  if (!isId(testCaseId)) {
    throw new Error(`Invalid test case id: ${testCaseId}`)
  }
  return `${testCasesPath(activityId)}/${testCaseId}`
}

// Only the fields of spec 08 R1, so extra properties on the caller's object never reach the server.
function activityBody(request: ActivityRequest): ActivityRequest {
  return { title: request.title, problemStatement: request.problemStatement, starterCode: request.starterCode }
}

function testCaseBody(request: TestCaseRequest): TestCaseRequest {
  return { input: request.input, expectedOutput: request.expectedOutput, hidden: request.hidden }
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
