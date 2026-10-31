import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TestCase } from '../../api/activitiesApi.ts'
import type { ExecutionResult } from '../runner/pythonRunner.ts'
import type { RunReport } from '../runner/runTests.ts'
import { useRunTests } from './useRunTests.ts'

const TESTS: TestCase[] = [
  { id: 1, position: 1, input: '3', expectedOutput: '6', hidden: false },
  { id: 2, position: 2, input: '5', expectedOutput: '10', hidden: true },
]

// A runner whose results the test hands out one at a time, so the 'running' state can be observed.
function controlledRunner() {
  const pending: ((result: ExecutionResult) => void)[] = []
  const run = vi.fn(
    (_code: string, _stdin: string) => new Promise<ExecutionResult>((resolve) => pending.push(resolve)),
  )
  async function answer(result: ExecutionResult): Promise<void> {
    await act(async () => {
      const next = pending.shift()
      if (!next) throw new Error('no run is waiting')
      next(result)
    })
  }
  return { runner: { run }, run, answer }
}

function instantRunner(result: ExecutionResult = { status: 'ok', stdout: '6\n' }) {
  const run = vi.fn(async (_code: string, _stdin: string) => result)
  return { runner: { run }, run }
}

interface HookProps {
  code: string
  testCases: readonly TestCase[]
  runner: { run: (code: string, stdin: string) => Promise<ExecutionResult> }
}

function renderRunTests(props: HookProps) {
  return renderHook((current: HookProps) => useRunTests(current.code, current.testCases, current.runner), {
    initialProps: props,
  })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-31T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useRunTests', () => {
  it('starts idle with no report', () => {
    const { runner } = instantRunner()
    const { result } = renderRunTests({ code: 'x', testCases: TESTS, runner })

    expect(result.current.state).toBe('idle')
    expect(result.current.lastReport).toBeNull()
  })

  it('is running while the tests run and idle again with the report afterwards', async () => {
    const { runner, answer } = controlledRunner()
    const { result } = renderRunTests({ code: 'print(int(input()) * 2)', testCases: TESTS, runner })

    let promise: Promise<RunReport | null> = Promise.resolve(null)
    act(() => {
      promise = result.current.run()
    })
    expect(result.current.state).toBe('running')

    await answer({ status: 'ok', stdout: '6\n' })
    expect(result.current.state).toBe('running')
    await answer({ status: 'ok', stdout: '11\n' })

    const report = await promise
    expect(result.current.state).toBe('idle')
    expect(result.current.lastReport).toBe(report)
    expect(report).toMatchObject({ status: 'completed', passedCount: 1, totalCount: 2 })
    expect(report?.results.map((test) => test.status)).toEqual(['passed', 'failed'])
  })

  it('runs the current code against every test case through the runner', async () => {
    const { runner, run } = instantRunner()
    const { result, rerender } = renderRunTests({ code: 'old', testCases: TESTS, runner })
    rerender({ code: 'new', testCases: TESTS, runner })

    await act(async () => {
      await result.current.run()
    })

    expect(run.mock.calls).toEqual([
      ['new', '3'],
      ['new', '5'],
    ])
  })

  it('uses the code from when run was called, even if the student edits during the run', async () => {
    const { runner, run, answer } = controlledRunner()
    const { result, rerender } = renderRunTests({ code: 'first', testCases: TESTS, runner })

    act(() => {
      void result.current.run()
    })
    rerender({ code: 'edited', testCases: TESTS, runner })
    await answer({ status: 'ok', stdout: '6' })
    await answer({ status: 'ok', stdout: '10' })

    expect(run.mock.calls.map(([code]) => code)).toEqual(['first', 'first'])
  })

  it('keeps the same run and onReportReady functions across renders', () => {
    const { runner } = instantRunner()
    const { result, rerender } = renderRunTests({ code: 'a', testCases: TESTS, runner })
    const { run, onReportReady } = result.current

    rerender({ code: 'b', testCases: TESTS, runner })

    expect(result.current.run).toBe(run)
    expect(result.current.onReportReady).toBe(onReportReady)
  })

  it('ignores a second run while one is in progress', async () => {
    const { runner, run, answer } = controlledRunner()
    const { result } = renderRunTests({ code: 'x', testCases: TESTS, runner })

    let second: Promise<RunReport | null> = Promise.resolve(null)
    act(() => {
      void result.current.run()
      second = result.current.run()
    })

    expect(await second).toBeNull()
    expect(run).toHaveBeenCalledTimes(1)
    await answer({ status: 'ok', stdout: '6' })
    await answer({ status: 'ok', stdout: '10' })
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('calls each onReportReady listener once per run with the report', async () => {
    const { runner } = instantRunner()
    const { result } = renderRunTests({ code: 'x', testCases: TESTS, runner })
    const listener = vi.fn()
    act(() => {
      result.current.onReportReady(listener)
    })

    let first: RunReport | null = null
    await act(async () => {
      first = await result.current.run()
    })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(first)

    await act(async () => {
      await result.current.run()
    })
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('hands the listener a report whose state is already idle', async () => {
    const { runner } = instantRunner()
    const { result } = renderRunTests({ code: 'x', testCases: TESTS, runner })
    const statesSeen: string[] = []
    act(() => {
      result.current.onReportReady(() => statesSeen.push(result.current.state))
    })

    await act(async () => {
      await result.current.run()
    })

    expect(statesSeen).toHaveLength(1)
    expect(result.current.state).toBe('idle')
  })

  it('stops calling a listener after it unsubscribes', async () => {
    const { runner } = instantRunner()
    const { result } = renderRunTests({ code: 'x', testCases: TESTS, runner })
    const listener = vi.fn()
    let unsubscribe: () => void = () => {}
    act(() => {
      unsubscribe = result.current.onReportReady(listener)
    })

    act(() => unsubscribe())
    await act(async () => {
      await result.current.run()
    })

    expect(listener).not.toHaveBeenCalled()
  })

  it('reports an unavailable runner as a report, so the caller can tell it apart', async () => {
    const { runner } = instantRunner({ status: 'unavailable', message: 'The Python worker crashed.' })
    const { result } = renderRunTests({ code: 'x', testCases: TESTS, runner })
    const listener = vi.fn()
    act(() => {
      result.current.onReportReady(listener)
    })

    let report: RunReport | null = null
    await act(async () => {
      report = await result.current.run()
    })

    expect(report).toMatchObject({ status: 'unavailable', message: 'The Python worker crashed.', errorSignature: null })
    expect(result.current.lastReport).toBe(report)
    expect(listener).toHaveBeenCalledWith(report)
  })

  it('goes back to idle, keeps the last report and returns null when the runner rejects', async () => {
    const good = instantRunner()
    const { result, rerender } = renderRunTests({ code: 'x', testCases: TESTS, runner: good.runner })
    await act(async () => {
      await result.current.run()
    })
    const previous = result.current.lastReport
    const listener = vi.fn()
    act(() => {
      result.current.onReportReady(listener)
    })
    const failing = { run: vi.fn(async (): Promise<ExecutionResult> => Promise.reject(new Error('busy'))) }
    rerender({ code: 'x', testCases: TESTS, runner: failing })

    let report: RunReport | null = previous
    await act(async () => {
      report = await result.current.run()
    })

    expect(report).toBeNull()
    expect(result.current.state).toBe('idle')
    expect(result.current.lastReport).toBe(previous)
    expect(listener).not.toHaveBeenCalled()
  })

  it('does not call listeners for a run that finishes after unmount', async () => {
    const { runner, answer } = controlledRunner()
    const { result, unmount } = renderRunTests({ code: 'x', testCases: [TESTS[0]], runner })
    const listener = vi.fn()
    act(() => {
      result.current.onReportReady(listener)
    })

    let promise: Promise<RunReport | null> = Promise.resolve(null)
    act(() => {
      promise = result.current.run()
    })
    unmount()
    await answer({ status: 'unavailable', message: 'The Python runner was disposed.' })

    expect((await promise)?.status).toBe('unavailable')
    expect(listener).not.toHaveBeenCalled()
  })

  it('runs again after a timeout', async () => {
    const { runner, run, answer } = controlledRunner()
    const { result } = renderRunTests({ code: 'while True: pass', testCases: TESTS, runner })

    let first: Promise<RunReport | null> = Promise.resolve(null)
    act(() => {
      first = result.current.run()
    })
    await answer({ status: 'timeout' })
    expect((await first)?.results.map((test) => test.status)).toEqual(['timeout', 'not_run'])
    expect(result.current.state).toBe('idle')

    act(() => {
      void result.current.run()
    })
    expect(result.current.state).toBe('running')
    expect(run).toHaveBeenCalledTimes(2)
  })
})
