import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TestCase } from '../../api/activitiesApi.ts'
import type { ExecutionResult } from './pythonRunner.ts'
import { runTests } from './runTests.ts'

function testCase(position: number, expectedOutput: string, overrides: Partial<TestCase> = {}): TestCase {
  return { id: position * 10, position, input: `in${position}`, expectedOutput, hidden: false, ...overrides }
}

// A fake runner that answers with the given results in order and records what it was asked to run.
function fakeRunner(results: ExecutionResult[]) {
  const calls: { code: string; stdin: string }[] = []
  const run = vi.fn((code: string, stdin: string): Promise<ExecutionResult> => {
    calls.push({ code, stdin })
    const next = results[calls.length - 1]
    if (!next) return Promise.reject(new Error('unexpected run'))
    return Promise.resolve(next)
  })
  return { runner: { run }, calls, run }
}

const ok = (stdout: string): ExecutionResult => ({ status: 'ok', stdout })

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-31T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('runTests', () => {
  it('passes a test whose output matches after normalization', async () => {
    const { runner } = fakeRunner([ok('5\r\n\n')])

    const report = await runTests('code', [testCase(1, '5')], runner)

    expect(report.status).toBe('completed')
    expect(report.results).toEqual([
      { testCaseId: 10, position: 1, hidden: false, status: 'passed', actualOutput: '5\r\n\n' },
    ])
    expect(report.passedCount).toBe(1)
    expect(report.totalCount).toBe(1)
    expect(report.errorSignature).toBeNull()
    expect(report.firstError).toBeNull()
  })

  it('fails a test whose output differs and keeps the actual output', async () => {
    const { runner } = fakeRunner([ok('6\n')])

    const report = await runTests('code', [testCase(1, '5')], runner)

    expect(report.results[0]).toMatchObject({ status: 'failed', actualOutput: '6\n' })
    expect(report.passedCount).toBe(0)
    expect(report.errorSignature).toBeNull()
    expect(report.firstError).toBeNull()
  })

  it('passes the code and the test input to the runner', async () => {
    const { runner, calls } = fakeRunner([ok('a'), ok('b')])

    await runTests('print(1)', [testCase(1, 'a'), testCase(2, 'b')], runner)

    expect(calls).toEqual([
      { code: 'print(1)', stdin: 'in1' },
      { code: 'print(1)', stdin: 'in2' },
    ])
  })

  it('runs tests one at a time, in position order, whatever the order given', async () => {
    const order: string[] = []
    let running = 0
    let maxRunning = 0
    const runner = {
      run: vi.fn(async (_code: string, stdin: string): Promise<ExecutionResult> => {
        running += 1
        maxRunning = Math.max(maxRunning, running)
        order.push(stdin)
        await Promise.resolve()
        running -= 1
        return ok('')
      }),
    }

    const report = await runTests('c', [testCase(3, ''), testCase(1, ''), testCase(2, '')], runner)

    expect(order).toEqual(['in1', 'in2', 'in3'])
    expect(maxRunning).toBe(1)
    expect(report.results.map((r) => r.position)).toEqual([1, 2, 3])
  })

  it('does not change the array it is given', async () => {
    const { runner } = fakeRunner([ok(''), ok('')])
    const cases = [testCase(2, ''), testCase(1, '')]

    await runTests('c', cases, runner)

    expect(cases.map((c) => c.position)).toEqual([2, 1])
  })

  it('reports an error with its partial output and keeps running the next tests', async () => {
    const error = { type: 'ZeroDivisionError', message: 'division by zero', line: 2 }
    const { runner, run } = fakeRunner([{ status: 'error', stdout: 'partial', error }, ok('b')])

    const report = await runTests('c', [testCase(1, 'a'), testCase(2, 'b')], runner)

    expect(run).toHaveBeenCalledTimes(2)
    expect(report.results[0]).toEqual({
      testCaseId: 10,
      position: 1,
      hidden: false,
      status: 'error',
      actualOutput: 'partial',
      error,
    })
    expect(report.results[1]).toMatchObject({ status: 'passed' })
    expect(report.passedCount).toBe(1)
    expect(report.errorSignature).toBe('ZeroDivisionError@2')
    expect(report.firstError).toEqual(error)
  })

  it('takes the signature and first error from the first error test only', async () => {
    const first = { type: 'ValueError', message: 'a', line: 3 }
    const second = { type: 'TypeError', message: 'b', line: 9 }
    const { runner } = fakeRunner([
      ok('x'),
      { status: 'error', stdout: '', error: first },
      { status: 'error', stdout: '', error: second },
    ])

    const report = await runTests('c', [testCase(1, 'x'), testCase(2, 'x'), testCase(3, 'x')], runner)

    expect(report.errorSignature).toBe('ValueError@3')
    expect(report.firstError).toEqual(first)
  })

  it('stops at a timeout and marks the later tests not_run', async () => {
    const { runner, run } = fakeRunner([ok('1'), { status: 'timeout' }])
    const cases = [testCase(1, '1'), testCase(2, '2'), testCase(3, '3'), testCase(4, '4')]

    const report = await runTests('c', cases, runner)

    expect(run).toHaveBeenCalledTimes(2)
    expect(report.results.map((r) => r.status)).toEqual(['passed', 'timeout', 'not_run', 'not_run'])
    expect(report.totalCount).toBe(4)
    expect(report.passedCount).toBe(1)
    expect(report.status).toBe('completed')
    expect(report.errorSignature).toBe('Timeout@?')
    expect(report.firstError).toBe('timeout')
  })

  it('uses the earlier error, not a later timeout, for the signature', async () => {
    const error = { type: 'NameError', message: 'x', line: 1 }
    const { runner } = fakeRunner([{ status: 'error', stdout: '', error }, { status: 'timeout' }])

    const report = await runTests('c', [testCase(1, ''), testCase(2, '')], runner)

    expect(report.results.map((r) => r.status)).toEqual(['error', 'timeout'])
    expect(report.errorSignature).toBe('NameError@1')
    expect(report.firstError).toEqual(error)
  })

  it('uses the earlier timeout for the signature when it comes first', async () => {
    const { runner } = fakeRunner([{ status: 'timeout' }])

    const report = await runTests('c', [testCase(1, ''), testCase(2, '')], runner)

    expect(report.errorSignature).toBe('Timeout@?')
    expect(report.firstError).toBe('timeout')
  })

  it('stops when the runner is unavailable and reports the message', async () => {
    const { runner, run } = fakeRunner([ok('1'), { status: 'unavailable', message: 'worker crashed' }])

    const report = await runTests('c', [testCase(1, '1'), testCase(2, '2'), testCase(3, '3')], runner)

    expect(run).toHaveBeenCalledTimes(2)
    expect(report.status).toBe('unavailable')
    expect(report.message).toBe('worker crashed')
    expect(report.results.map((r) => r.status)).toEqual(['passed', 'not_run', 'not_run'])
    expect(report.totalCount).toBe(3)
    expect(report.passedCount).toBe(1)
    expect(report.errorSignature).toBeNull()
    expect(report.firstError).toBeNull()
  })

  it('carries no signature or first error when the runner becomes unavailable after an error', async () => {
    const error = { type: 'ValueError', message: 'x', line: 1 }
    const { runner } = fakeRunner([
      { status: 'error', stdout: '', error },
      { status: 'unavailable', message: 'gone' },
    ])

    const report = await runTests('c', [testCase(1, ''), testCase(2, '')], runner)

    expect(report.status).toBe('unavailable')
    expect(report.results.map((r) => r.status)).toEqual(['error', 'not_run'])
    expect(report.errorSignature).toBeNull()
    expect(report.firstError).toBeNull()
  })

  it('has no message on a completed report', async () => {
    const { runner } = fakeRunner([ok('')])

    const report = await runTests('c', [testCase(1, '')], runner)

    expect(report).not.toHaveProperty('message')
  })

  it('treats hidden tests exactly like visible ones and keeps the hidden flag', async () => {
    const { runner, run } = fakeRunner([ok('1'), ok('nope')])

    const report = await runTests('c', [testCase(1, '1'), testCase(2, '2', { hidden: true })], runner)

    expect(run).toHaveBeenCalledTimes(2)
    expect(report.results.map((r) => [r.hidden, r.status])).toEqual([
      [false, 'passed'],
      [true, 'failed'],
    ])
    expect(report.results[1]).toMatchObject({ actualOutput: 'nope' })
  })

  it('counts only passed tests', async () => {
    const error = { type: 'E', message: '', line: null }
    const { runner } = fakeRunner([ok('1'), ok('x'), { status: 'error', stdout: '', error }, { status: 'timeout' }])
    const cases = [1, 2, 3, 4, 5].map((p) => testCase(p, '1'))

    const report = await runTests('c', cases, runner)

    expect(report.results.map((r) => r.status)).toEqual(['passed', 'failed', 'error', 'timeout', 'not_run'])
    expect(report.passedCount).toBe(1)
    expect(report.totalCount).toBe(5)
    expect(report.errorSignature).toBe('E@?')
  })

  it('returns an empty completed report for no tests, without running anything', async () => {
    const { runner, run } = fakeRunner([])

    const report = await runTests('c', [], runner)

    expect(run).not.toHaveBeenCalled()
    expect(report).toMatchObject({
      status: 'completed',
      results: [],
      passedCount: 0,
      totalCount: 0,
      errorSignature: null,
      firstError: null,
    })
  })

  it('stamps finishedAt with the time the last test finished', async () => {
    const { runner } = fakeRunner([ok('')])

    const report = await runTests('c', [testCase(1, '')], runner)

    expect(report.finishedAt).toBe(new Date('2026-10-31T12:00:00Z').getTime())
  })

  it('lets a rejected run (for example busy) reject the whole call', async () => {
    const runner = { run: vi.fn(() => Promise.reject(new Error('busy'))) }

    await expect(runTests('c', [testCase(1, '')], runner)).rejects.toThrow('busy')
  })
})
