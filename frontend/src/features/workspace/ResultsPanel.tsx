import { useId } from 'react'
import type { TestCase } from '../../api/activitiesApi.ts'
import { RUN_TIMEOUT_MS } from '../runner/runnerConfig.ts'
import type { PythonError } from '../runner/runnerProtocol.ts'
import type { RunReport, TestResult, TestStatus } from '../runner/runTests.ts'
import styles from './ResultsPanel.module.css'

interface ResultsPanelProps {
  report: RunReport | null
  testCases: readonly TestCase[]
}

const STATUS_LABELS: Record<TestStatus, string> = {
  passed: 'Passed',
  failed: 'Failed',
  error: 'Error',
  timeout: 'Timed out',
  not_run: 'Not run',
}

const TIMEOUT_MESSAGE = `Your code ran longer than ${RUN_TIMEOUT_MS / 1000} seconds and was stopped. Check for a loop that never ends.`

type ErrorDetail = { kind: 'error'; error: PythonError } | { kind: 'timeout' }

// Spec 14 R7 and ui-context.md → Results Panel. Hidden tests show their name and status only (Q8),
// so the error block takes the first error from a visible test. A timeout carries no test data,
// so its message is shown whichever test ran too long.
function ResultsPanel({ report, testCases }: ResultsPanelProps) {
  const headingId = useId()
  const testCaseById = new Map(testCases.map((testCase) => [testCase.id, testCase]))
  const detail = report ? errorDetail(report.results) : null

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        Test results
      </h2>
      <div aria-live="polite">
        <p className={report ? styles.summary : styles.placeholder}>
          {report ? summary(report) : 'Run your code to see test results here.'}
        </p>
      </div>
      {report?.status === 'unavailable' && (
        <p role="alert" className={styles.errorBlock}>
          {report.message}
        </p>
      )}
      {detail && <ErrorBlock detail={detail} />}
      {report && (
        <ol aria-label="Test cases" className={styles.list}>
          {report.results.map((result, index) => (
            <ResultRow key={result.testCaseId} result={result} number={index + 1} testCase={testCaseById.get(result.testCaseId)} />
          ))}
        </ol>
      )}
    </section>
  )
}

function ErrorBlock({ detail }: { detail: ErrorDetail }) {
  const titleId = useId()

  if (detail.kind === 'timeout') {
    return <p className={styles.errorBlock}>{TIMEOUT_MESSAGE}</p>
  }
  const { type, line, message } = detail.error
  return (
    <section className={styles.errorBlock} aria-labelledby={titleId}>
      <h3 className={styles.visuallyHidden} id={titleId}>
        Runtime error
      </h3>
      <p className={styles.errorTitle}>{line === null ? type : `${type} on line ${line}`}</p>
      <pre className={styles.errorMessage}>{message}</pre>
    </section>
  )
}

function ResultRow({ result, number, testCase }: { result: TestResult; number: number; testCase: TestCase | undefined }) {
  const showDetails = !result.hidden && result.status === 'failed' && testCase !== undefined

  return (
    <li className={styles.row}>
      <div className={styles.rowHeader}>
        <h3 className={styles.name}>{result.hidden ? `Hidden test ${number}` : `Test ${number}`}</h3>
        <span className={`${styles.status} ${styles[result.status]}`}>{STATUS_LABELS[result.status]}</span>
      </div>
      {showDetails && (
        <dl className={styles.values}>
          <dt>Input</dt>
          <dd>
            <pre className={styles.block}>{testCase.input}</pre>
          </dd>
          <dt>Expected output</dt>
          <dd>
            <pre className={styles.block}>{testCase.expectedOutput}</pre>
          </dd>
          <dt>Actual output</dt>
          <dd>
            <pre className={styles.block}>{result.actualOutput ?? ''}</pre>
          </dd>
        </dl>
      )}
    </li>
  )
}

function summary(report: RunReport): string {
  return `${report.passedCount} of ${report.totalCount} ${report.totalCount === 1 ? 'test' : 'tests'} passed`
}

function errorDetail(results: readonly TestResult[]): ErrorDetail | null {
  for (const result of results) {
    if (result.hidden) continue
    if (result.status === 'error' && result.error) return { kind: 'error', error: result.error }
    if (result.status === 'timeout') return { kind: 'timeout' }
  }
  return results.some((result) => result.status === 'timeout') ? { kind: 'timeout' } : null
}

export default ResultsPanel
