import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { TestCase } from '../../api/activitiesApi.ts'
import { RUN_TIMEOUT_MS } from '../runner/runnerConfig.ts'
import type { RunReport, TestResult } from '../runner/runTests.ts'
import ResultsPanel from './ResultsPanel.tsx'

const TESTS: TestCase[] = [
  { id: 11, position: 1, input: 'visible in 1', expectedOutput: 'visible out 1', hidden: false },
  { id: 12, position: 2, input: 'hidden in 2', expectedOutput: 'hidden out 2', hidden: true },
  { id: 13, position: 3, input: 'visible in 3', expectedOutput: 'visible out 3', hidden: false },
]

const TIMEOUT_TEXT = `Your code ran longer than ${RUN_TIMEOUT_MS / 1000} seconds and was stopped. Check for a loop that never ends.`

function result(testCase: TestCase, status: TestResult['status'], extra: Partial<TestResult> = {}): TestResult {
  return { testCaseId: testCase.id, position: testCase.position, hidden: testCase.hidden, status, ...extra }
}

function report(results: TestResult[], extra: Partial<RunReport> = {}): RunReport {
  return {
    status: 'completed',
    results,
    passedCount: results.filter((test) => test.status === 'passed').length,
    totalCount: results.length,
    errorSignature: null,
    firstError: null,
    finishedAt: 1,
    ...extra,
  }
}

function rows(): HTMLElement[] {
  return within(screen.getByRole('list', { name: 'Test cases' })).getAllByRole('listitem')
}

function row(name: string): HTMLElement {
  const match = rows().find((item) => within(item).queryByText(name, { selector: 'h3' }))
  if (!match) throw new Error(`No row named ${name}`)
  return match
}

describe('ResultsPanel', () => {
  it('shows the placeholder before the first run', () => {
    render(<ResultsPanel report={null} testCases={TESTS} />)

    const panel = screen.getByRole('region', { name: 'Test results' })
    expect(within(panel).getByText('Run your code to see test results here.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('shows the summary with the number passed out of all tests', () => {
    render(
      <ResultsPanel
        report={report([result(TESTS[0], 'passed'), result(TESTS[1], 'passed'), result(TESTS[2], 'failed', { actualOutput: 'x' })])}
        testCases={TESTS}
      />,
    )

    expect(screen.getByText('2 of 3 tests passed')).toBeInTheDocument()
    expect(screen.queryByText('Run your code to see test results here.')).not.toBeInTheDocument()
  })

  it('uses the singular for a single test', () => {
    render(<ResultsPanel report={report([result(TESTS[0], 'failed', { actualOutput: '' })])} testCases={TESTS} />)

    expect(screen.getByText('0 of 1 test passed')).toBeInTheDocument()
  })

  it('announces the summary politely to screen readers', () => {
    render(<ResultsPanel report={report([result(TESTS[0], 'passed')])} testCases={TESTS} />)

    expect(screen.getByText('1 of 1 test passed').closest('[aria-live="polite"]')).not.toBeNull()
  })

  it('names visible tests "Test K" and hidden ones "Hidden test K", in position order', () => {
    render(
      <ResultsPanel
        report={report([result(TESTS[0], 'passed'), result(TESTS[1], 'passed'), result(TESTS[2], 'passed')])}
        testCases={TESTS}
      />,
    )

    expect(rows().map((item) => within(item).getByRole('heading').textContent)).toEqual([
      'Test 1',
      'Hidden test 2',
      'Test 3',
    ])
  })

  it.each([
    ['passed', 'Passed'],
    ['failed', 'Failed'],
    ['error', 'Error'],
    ['timeout', 'Timed out'],
    ['not_run', 'Not run'],
  ] as const)('labels the %s status as "%s"', (status, label) => {
    const extra: Partial<TestResult> =
      status === 'error'
        ? { actualOutput: '', error: { type: 'ValueError', message: 'bad', line: 1 } }
        : status === 'failed'
          ? { actualOutput: 'x' }
          : {}
    render(<ResultsPanel report={report([result(TESTS[0], status, extra)])} testCases={TESTS} />)

    expect(within(row('Test 1')).getByText(label)).toBeInTheDocument()
  })

  it('shows the input, expected output and actual output of a failed visible test', () => {
    render(
      <ResultsPanel report={report([result(TESTS[0], 'failed', { actualOutput: 'wrong 1\n' })])} testCases={TESTS} />,
    )

    const failed = row('Test 1')
    expect(within(failed).getByText('Input')).toBeInTheDocument()
    expect(within(failed).getByText('visible in 1').tagName).toBe('PRE')
    expect(within(failed).getByText('Expected output')).toBeInTheDocument()
    expect(within(failed).getByText('visible out 1').tagName).toBe('PRE')
    expect(within(failed).getByText('Actual output')).toBeInTheDocument()
    expect(within(failed).getByText((_, element) => element?.tagName === 'PRE' && element.textContent === 'wrong 1\n')).toBeInTheDocument()
  })

  it('shows no details for a passed visible test', () => {
    render(<ResultsPanel report={report([result(TESTS[0], 'passed', { actualOutput: 'visible out 1' })])} testCases={TESTS} />)

    expect(within(row('Test 1')).queryByText('Input')).not.toBeInTheDocument()
    expect(screen.queryByText('visible in 1')).not.toBeInTheDocument()
  })

  it('shows only the name and status of a failed hidden test', () => {
    render(
      <ResultsPanel
        report={report([result(TESTS[0], 'passed'), result(TESTS[1], 'failed', { actualOutput: 'hidden actual' })])}
        testCases={TESTS}
      />,
    )

    const hidden = row('Hidden test 2')
    expect(within(hidden).getByText('Failed')).toBeInTheDocument()
    expect(within(hidden).queryByText('Input')).not.toBeInTheDocument()
    expect(screen.queryByText('hidden in 2')).not.toBeInTheDocument()
    expect(screen.queryByText('hidden out 2')).not.toBeInTheDocument()
    expect(screen.queryByText('hidden actual')).not.toBeInTheDocument()
  })

  it('shows no error details when the only runtime error came from a hidden test', () => {
    const error = { type: 'IndexError', message: 'list index out of range', line: 4 }
    render(
      <ResultsPanel
        report={report(
          [result(TESTS[0], 'passed'), result(TESTS[1], 'error', { actualOutput: 'hidden partial', error }), result(TESTS[2], 'passed')],
          { firstError: error, errorSignature: 'IndexError@4' },
        )}
        testCases={TESTS}
      />,
    )

    expect(within(row('Hidden test 2')).getByText('Error')).toBeInTheDocument()
    expect(screen.queryByText(/IndexError/)).not.toBeInTheDocument()
    expect(screen.queryByText('list index out of range')).not.toBeInTheDocument()
    expect(screen.queryByText('hidden partial')).not.toBeInTheDocument()
  })

  it('shows the type, line and message of the first runtime error in a visible test', () => {
    const error = { type: 'ZeroDivisionError', message: 'division by zero', line: 2 }
    render(
      <ResultsPanel
        report={report([result(TESTS[0], 'error', { actualOutput: '', error })], { firstError: error })}
        testCases={TESTS}
      />,
    )

    const block = screen.getByRole('region', { name: 'Runtime error' })
    expect(within(block).getByText('ZeroDivisionError on line 2')).toBeInTheDocument()
    expect(within(block).getByText('division by zero').tagName).toBe('PRE')
  })

  it('shows the first visible runtime error when a hidden test errored before it', () => {
    const hiddenError = { type: 'IndexError', message: 'hidden detail', line: 4 }
    const visibleError = { type: 'ValueError', message: 'invalid literal', line: 1 }
    render(
      <ResultsPanel
        report={report(
          [
            result(TESTS[0], 'passed'),
            result(TESTS[1], 'error', { actualOutput: '', error: hiddenError }),
            result(TESTS[2], 'error', { actualOutput: '', error: visibleError }),
          ],
          { firstError: hiddenError },
        )}
        testCases={TESTS}
      />,
    )

    expect(screen.getByText('ValueError on line 1')).toBeInTheDocument()
    expect(screen.queryByText('hidden detail')).not.toBeInTheDocument()
  })

  it('shows only the type when the error has no line', () => {
    const error = { type: 'MemoryError', message: 'out of memory', line: null }
    render(
      <ResultsPanel
        report={report([result(TESTS[0], 'error', { actualOutput: '', error })], { firstError: error })}
        testCases={TESTS}
      />,
    )

    expect(screen.getByText('MemoryError', { selector: 'p' })).toBeInTheDocument()
    expect(screen.queryByText(/on line/)).not.toBeInTheDocument()
  })

  it('shows the timeout message with the limit in seconds', () => {
    render(
      <ResultsPanel
        report={report([result(TESTS[0], 'timeout'), result(TESTS[1], 'not_run'), result(TESTS[2], 'not_run')], {
          firstError: 'timeout',
          errorSignature: 'Timeout@?',
        })}
        testCases={TESTS}
      />,
    )

    expect(screen.getByText(TIMEOUT_TEXT)).toBeInTheDocument()
    expect(TIMEOUT_TEXT).toContain('3 seconds')
    expect(within(row('Hidden test 2')).getByText('Not run')).toBeInTheDocument()
    expect(within(row('Test 3')).getByText('Not run')).toBeInTheDocument()
  })

  it('shows the timeout message when a hidden test timed out, without its details', () => {
    render(
      <ResultsPanel
        report={report([result(TESTS[0], 'passed'), result(TESTS[1], 'timeout'), result(TESTS[2], 'not_run')], {
          firstError: 'timeout',
        })}
        testCases={TESTS}
      />,
    )

    expect(screen.getByText(TIMEOUT_TEXT)).toBeInTheDocument()
    expect(screen.queryByText('hidden in 2')).not.toBeInTheDocument()
  })

  it('shows no error block when every test passed', () => {
    render(<ResultsPanel report={report([result(TESTS[0], 'passed')])} testCases={TESTS} />)

    expect(screen.queryByRole('region', { name: 'Runtime error' })).not.toBeInTheDocument()
    expect(screen.queryByText(TIMEOUT_TEXT)).not.toBeInTheDocument()
  })

  it('shows the runner message when Python was not available for the run', () => {
    render(
      <ResultsPanel
        report={report([result(TESTS[0], 'not_run'), result(TESTS[1], 'not_run'), result(TESTS[2], 'not_run')], {
          status: 'unavailable',
          message: 'The Python worker crashed.',
        })}
        testCases={TESTS}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('The Python worker crashed.')
    expect(screen.getByText('0 of 3 tests passed')).toBeInTheDocument()
  })
})
