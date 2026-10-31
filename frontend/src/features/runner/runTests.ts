import type { TestCase } from '../../api/activitiesApi.ts'
import { compareOutput } from './compareOutput.ts'
import { errorSignature } from './errorSignature.ts'
import type { PythonRunner } from './pythonRunner.ts'
import type { PythonError } from './runnerProtocol.ts'

export type TestStatus = 'passed' | 'failed' | 'error' | 'timeout' | 'not_run'

export interface TestResult {
  testCaseId: number
  position: number
  hidden: boolean
  status: TestStatus
  actualOutput?: string
  error?: PythonError
}

export interface RunReport {
  status: 'completed' | 'unavailable'
  // Set only when `status` is 'unavailable'.
  message?: string
  results: TestResult[]
  passedCount: number
  totalCount: number
  errorSignature: string | null
  firstError: PythonError | 'timeout' | null
  finishedAt: number
}

// Hidden tests run like visible ones; hiding them is a display concern (Q8).
// A timeout (Q14) or an unavailable runner stops the run, and the tests not reached are `not_run`.
export async function runTests(
  code: string,
  testCases: readonly TestCase[],
  runner: Pick<PythonRunner, 'run'>,
): Promise<RunReport> {
  const ordered = [...testCases].sort((a, b) => a.position - b.position)
  const results: TestResult[] = []
  let status: RunReport['status'] = 'completed'
  let message: string | undefined
  let signature: string | null = null
  let firstError: RunReport['firstError'] = null

  for (const testCase of ordered) {
    const base = { testCaseId: testCase.id, position: testCase.position, hidden: testCase.hidden }
    const result = await runner.run(code, testCase.input)

    if (result.status === 'unavailable') {
      status = 'unavailable'
      message = result.message
      break
    }

    if (result.status === 'timeout') {
      results.push({ ...base, status: 'timeout' })
      signature ??= errorSignature(result)
      firstError ??= 'timeout'
      break
    }

    if (result.status === 'error') {
      results.push({ ...base, status: 'error', actualOutput: result.stdout, error: result.error })
      signature ??= errorSignature(result)
      firstError ??= result.error
      continue
    }

    const passed = compareOutput(testCase.expectedOutput, result.stdout)
    results.push({ ...base, status: passed ? 'passed' : 'failed', actualOutput: result.stdout })
  }

  for (const testCase of ordered.slice(results.length)) {
    results.push({ testCaseId: testCase.id, position: testCase.position, hidden: testCase.hidden, status: 'not_run' })
  }

  return {
    status,
    ...(message === undefined ? {} : { message }),
    results,
    passedCount: results.filter((result) => result.status === 'passed').length,
    totalCount: ordered.length,
    // An unavailable run produces no telemetry (spec 17), so it carries no error even if a test errored before it.
    errorSignature: status === 'unavailable' ? null : signature,
    firstError: status === 'unavailable' ? null : firstError,
    finishedAt: Date.now(),
  }
}
