import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/ApiError.ts'
import { endSession, sendEvents, startSession, type BatchResponse, type SessionStart } from '../../api/sessionsApi.ts'
import type { ConsentStatus } from '../consent/useConsent.ts'
import type { RunReport } from '../runner/runTests.ts'
import { EDIT_COALESCE_MS } from './editCoalescer.ts'
import { SEND_INTERVAL_MS } from './telemetryBuffer.ts'
import { useTelemetrySession } from './useTelemetrySession.ts'

vi.mock('../../api/sessionsApi.ts', () => ({
  startSession: vi.fn(),
  endSession: vi.fn(),
  sendEvents: vi.fn(),
}))

// The hook only needs a request runner that passes a token; 401 handling is spec 07's and tested there.
vi.mock('../../auth/useProtectedRequest.ts', () => ({
  useProtectedRequest: () => async (call: (token: string) => Promise<unknown>) => call('token-7'),
}))

const startMock = vi.mocked(startSession)
const endMock = vi.mocked(endSession)
const sendMock = vi.mocked(sendEvents)

const T0 = Date.parse('2026-11-03T02:15:00Z')
const START: SessionStart = { sessionId: 5, activityId: 42, startedAt: '2026-11-03T02:00:00Z', resumed: false }
const RESPONSE: BatchResponse = { accepted: 2, duplicates: 0 }

function report(overrides: Partial<RunReport> = {}): RunReport {
  return {
    status: 'completed',
    results: [],
    passedCount: 1,
    totalCount: 4,
    errorSignature: null,
    firstError: null,
    finishedAt: T0 + 5000,
    ...overrides,
  }
}

function renderSession(consentStatus: ConsentStatus = 'accepted') {
  return renderHook((props: { consentStatus: ConsentStatus }) => useTelemetrySession({ activityId: 42, ...props }), {
    initialProps: { consentStatus },
  })
}

async function started(consentStatus: ConsentStatus = 'accepted') {
  const hook = renderSession(consentStatus)
  await act(async () => {})
  return hook
}

function sentEvents(call = 0) {
  return sendMock.mock.calls[call][2]
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
  startMock.mockResolvedValue(START)
  endMock.mockResolvedValue(undefined)
  sendMock.mockResolvedValue(RESPONSE)
})

afterEach(() => {
  vi.useRealTimers()
  vi.resetAllMocks()
})

describe('useTelemetrySession', () => {
  it.each<ConsentStatus>(['pending', 'declined'])('never starts a session or sends events when consent is %s', async (status) => {
    const { result, unmount } = await started(status)

    act(() => result.current.recordEdit({ charsAdded: 1, charsRemoved: 0, at: T0 }))
    await expect(result.current.recordRun(report())).resolves.toBeNull()
    await act(async () => vi.advanceTimersByTimeAsync(SEND_INTERVAL_MS * 2))
    unmount()

    expect(startMock).not.toHaveBeenCalled()
    expect(sendMock).not.toHaveBeenCalled()
    expect(endMock).not.toHaveBeenCalled()
    expect(result.current.sessionId).toBeNull()
  })

  it('starts the session once consent becomes accepted', async () => {
    const { result, rerender } = await started('pending')
    expect(startMock).not.toHaveBeenCalled()

    rerender({ consentStatus: 'accepted' })
    await act(async () => {})

    expect(startMock).toHaveBeenCalledWith('token-7', 42, expect.any(AbortSignal))
    expect(result.current.sessionId).toBe(5)
    expect(result.current.startResponse).toEqual(START)
    expect(result.current.unavailable).toBe(false)
  })

  it('sends the last edit, then ERROR and RUN with the run finish time, and returns the response', async () => {
    const { result } = await started()
    const listener = vi.fn()
    result.current.onBatchResponse(listener)

    act(() => result.current.recordEdit({ charsAdded: 3, charsRemoved: 1, at: T0 + 1000 }))
    let response: BatchResponse | null = null
    await act(async () => {
      response = await result.current.recordRun(report({ errorSignature: 'NameError@3', passedCount: 0 }))
    })

    expect(response).toEqual(RESPONSE)
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock.mock.calls[0].slice(0, 2)).toEqual(['token-7', 5])
    expect(sendMock.mock.calls[0][3]).toEqual({ keepalive: false })
    const finished = new Date(T0 + 5000).toISOString()
    expect(sentEvents()).toEqual([
      { type: 'EDIT', occurredAt: new Date(T0 + 1000).toISOString(), charsAdded: 3, charsRemoved: 1, clientEventId: expect.any(String) },
      { type: 'ERROR', occurredAt: finished, errorSignature: 'NameError@3', clientEventId: expect.any(String) },
      { type: 'RUN', occurredAt: finished, passedCount: 0, totalCount: 4, clientEventId: expect.any(String) },
    ])
    expect(listener).toHaveBeenCalledWith(RESPONSE)
  })

  it('a run without an error sends only RUN', async () => {
    const { result } = await started()
    await act(async () => {
      await result.current.recordRun(report())
    })
    expect(sentEvents().map((event) => event.type)).toEqual(['RUN'])
  })

  it('ignores an unavailable report and a report without tests', async () => {
    const { result } = await started()

    await expect(result.current.recordRun(report({ status: 'unavailable', message: 'down' }))).resolves.toBeNull()
    await expect(result.current.recordRun(report({ totalCount: 0, passedCount: 0 }))).resolves.toBeNull()

    expect(sendMock).not.toHaveBeenCalled()
  })

  it('coalesced edits are sent by the 10 s timer and reach the listeners', async () => {
    const { result } = await started()
    const listener = vi.fn()
    result.current.onBatchResponse(listener)

    act(() => result.current.recordEdit({ charsAdded: 1, charsRemoved: 0, at: T0 }))
    await act(async () => vi.advanceTimersByTimeAsync(EDIT_COALESCE_MS))
    expect(sendMock).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTimeAsync(SEND_INTERVAL_MS))

    expect(sentEvents().map((event) => event.type)).toEqual(['EDIT'])
    expect(listener).toHaveBeenCalledWith(RESPONSE)
  })

  it('an unsubscribed listener gets no more responses', async () => {
    const { result } = await started()
    const listener = vi.fn()
    const unsubscribe = result.current.onBatchResponse(listener)
    unsubscribe()

    await act(async () => {
      await result.current.recordRun(report())
    })

    expect(listener).not.toHaveBeenCalled()
  })

  it('a failed start leaves tracking off for the visit without retrying', async () => {
    startMock.mockRejectedValue(new ApiError({ status: 0, title: 'Network error', detail: 'x', fieldErrors: {} }))
    const { result } = await started()

    expect(result.current.unavailable).toBe(true)
    expect(result.current.sessionId).toBeNull()
    await expect(result.current.recordRun(report())).resolves.toBeNull()
    await act(async () => vi.advanceTimersByTimeAsync(SEND_INTERVAL_MS * 3))
    expect(startMock).toHaveBeenCalledTimes(1)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('unmounting sends the pending edit with keepalive, ends the session and stops the timers', async () => {
    const { result, unmount } = await started()
    act(() => result.current.recordEdit({ charsAdded: 2, charsRemoved: 0, at: T0 }))

    unmount()
    await act(async () => {})

    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock.mock.calls[0][3]).toEqual({ keepalive: true })
    expect(sentEvents().map((event) => event.type)).toEqual(['EDIT'])
    expect(endMock).toHaveBeenCalledWith('token-7', 5, { keepalive: true })

    await act(async () => vi.advanceTimersByTimeAsync(SEND_INTERVAL_MS * 3))
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(endMock).toHaveBeenCalledTimes(1)
  })

  it('pagehide ends the session once, even when the page unmounts afterwards', async () => {
    const { unmount } = await started()

    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    unmount()
    await act(async () => {})

    expect(endMock).toHaveBeenCalledTimes(1)
    expect(endMock).toHaveBeenCalledWith('token-7', 5, { keepalive: true })
  })

  it('unmounting before the start answers aborts it and creates no session', async () => {
    let resolveStart: (start: SessionStart) => void = () => undefined
    startMock.mockReturnValue(
      new Promise<SessionStart>((resolve) => {
        resolveStart = resolve
      }),
    )
    const { result, unmount } = renderSession()
    const signal = startMock.mock.calls[0][2]

    unmount()
    await act(async () => resolveStart(START))

    expect(signal?.aborted).toBe(true)
    expect(result.current.sessionId).toBeNull()
    expect(endMock).not.toHaveBeenCalled()
  })

  it('drops a batch the server rejects and keeps sending later events', async () => {
    const { result } = await started()
    sendMock.mockRejectedValueOnce(new ApiError({ status: 400, title: 'Bad Request', detail: 'x', fieldErrors: {} }))

    await act(async () => {
      await result.current.recordRun(report())
    })
    await act(async () => {
      await result.current.recordRun(report({ passedCount: 2 }))
    })

    expect(sendMock).toHaveBeenCalledTimes(2)
    expect(sentEvents(1)).toEqual([expect.objectContaining({ type: 'RUN', passedCount: 2 })])
  })

  it('keeps a batch that failed on the network and retries it with the same ids', async () => {
    const { result } = await started()
    sendMock.mockRejectedValueOnce(new ApiError({ status: 0, title: 'Network error', detail: 'x', fieldErrors: {} }))

    await act(async () => {
      await result.current.recordRun(report())
    })
    await act(async () => {
      await result.current.recordRun(report({ passedCount: 2 }))
    })

    const firstIds = sentEvents(0).map((event) => event.clientEventId)
    expect(sentEvents(1).map((event) => event.clientEventId).slice(0, 1)).toEqual(firstIds)
    expect(sentEvents(1)).toHaveLength(2)
  })
})
