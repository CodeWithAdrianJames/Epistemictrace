import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BatchResponse } from '../../api/sessionsApi.ts'
import type { RunReport } from '../runner/runTests.ts'
import { SERVER_WAIT_MS, useRunGate } from './useRunGate.ts'

const REPORT: RunReport = {
  status: 'completed',
  results: [],
  passedCount: 1,
  totalCount: 2,
  errorSignature: null,
  firstError: null,
  finishedAt: 0,
}

let resolveRecord: (response: BatchResponse | null) => void
const recordRun = vi.fn(
  () =>
    new Promise<BatchResponse | null>((resolve) => {
      resolveRecord = resolve
    }),
)

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  recordRun.mockClear()
})

describe('useRunGate', () => {
  it('waits until the server answers, then clears the wait without a notice', async () => {
    const { result } = renderHook(() => useRunGate(recordRun, true))

    act(() => result.current.handleReport(REPORT))
    expect(recordRun).toHaveBeenCalledWith(REPORT)
    expect(result.current.waiting).toBe(true)

    await act(async () => resolveRecord({ accepted: 1, duplicates: 0 }))

    expect(result.current.waiting).toBe(false)
    expect(result.current.unreachable).toBe(false)
  })

  it('fails open after 5 s without an answer and shows the notice', async () => {
    const { result } = renderHook(() => useRunGate(recordRun, true))
    act(() => result.current.handleReport(REPORT))

    await act(async () => vi.advanceTimersByTimeAsync(SERVER_WAIT_MS - 1))
    expect(result.current.waiting).toBe(true)
    await act(async () => vi.advanceTimersByTimeAsync(1))

    expect(result.current.waiting).toBe(false)
    expect(result.current.unreachable).toBe(true)
  })

  it('fails open at once when sending failed (null)', async () => {
    const { result } = renderHook(() => useRunGate(recordRun, true))
    act(() => result.current.handleReport(REPORT))
    await act(async () => resolveRecord(null))

    expect(result.current.waiting).toBe(false)
    expect(result.current.unreachable).toBe(true)
  })

  it('a later answered run clears the notice', async () => {
    const { result } = renderHook(() => useRunGate(recordRun, true))
    act(() => result.current.handleReport(REPORT))
    await act(async () => resolveRecord(null))

    act(() => result.current.handleReport(REPORT))
    await act(async () => resolveRecord({ accepted: 1, duplicates: 0 }))

    expect(result.current.unreachable).toBe(false)
  })

  it('does not gate without tracking, but still records the run', () => {
    const { result } = renderHook(() => useRunGate(recordRun, false))
    act(() => result.current.handleReport(REPORT))

    expect(recordRun).toHaveBeenCalledTimes(1)
    expect(result.current.waiting).toBe(false)
  })

  it('does not gate an unavailable report', () => {
    const { result } = renderHook(() => useRunGate(recordRun, true))
    act(() => result.current.handleReport({ ...REPORT, status: 'unavailable', message: 'down' }))
    expect(result.current.waiting).toBe(false)
  })
})
