import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { useAuth } from '../../auth/AuthProvider.tsx'
import { createPythonRunner } from '../runner/pythonRunner.ts'
import CodeEditor from './CodeEditor.tsx'
import styles from './WorkspacePage.module.css'
import { useDraft } from './useDraft.ts'

// Hard-coded programs for the manual checks of the Python runner (spec 12). Spec 14 removes them.
const RUNNER_SAMPLES = [
  { label: 'Double the input', code: 'print(int(input()) * 2)', stdin: '21' },
  { label: 'Infinite loop', code: 'while True:\n    pass', stdin: '' },
  { label: 'Divide by zero', code: 'x = 1\n1/0', stdin: '' },
  { label: 'Define x', code: 'x = 5\nprint(x)', stdin: '' },
  { label: 'Print x', code: 'print(x)', stdin: '' },
  { label: 'Read past the end', code: 'input()\ninput()', stdin: 'one line' },
] as const

// Temporary mount of the editor for manual checks (spec 11 R6), plus a temporary runner check
// (spec 12). Spec 14 replaces this page with the real workspace: the loaded activity, its starter
// code, the problem and results panels.
function WorkspacePage() {
  const { activityId = '' } = useParams()
  const { user } = useAuth()
  const [runner] = useState(() => createPythonRunner())
  const [runnerBusy, setRunnerBusy] = useState(false)
  const [runnerReport, setRunnerReport] = useState('')

  // The runner creates its worker lazily, so this is safe to repeat (React strict mode).
  useEffect(() => () => runner.dispose(), [runner])

  async function timed(label: string, action: () => Promise<unknown>): Promise<void> {
    setRunnerBusy(true)
    setRunnerReport(`${label}: running…`)
    const started = performance.now()
    try {
      const result = await action()
      const elapsed = Math.round(performance.now() - started)
      setRunnerReport(`${label} (${elapsed} ms): ${JSON.stringify(result ?? 'ready')}`)
    } catch (error) {
      setRunnerReport(`${label}: ${error instanceof Error ? error.message : 'failed'}`)
    } finally {
      setRunnerBusy(false)
    }
  }
  // RequireRole only renders this page for a signed-in student, so 'local' is a fallback only.
  const [code, setCode] = useDraft(user ? user.id : 'local', activityId, '')

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Activity workspace</h1>
      <section className={styles.runnerCheck} aria-label="Runner check (temporary)">
        <h2 className={styles.runnerHeading}>Runner check (temporary)</h2>
        <div className={styles.runnerButtons}>
          <button type="button" disabled={runnerBusy} onClick={() => void timed('Warm up', () => runner.warmUp())}>
            Warm up
          </button>
          {RUNNER_SAMPLES.map((sample) => (
            <button
              key={sample.label}
              type="button"
              disabled={runnerBusy}
              onClick={() => void timed(sample.label, () => runner.run(sample.code, sample.stdin))}
            >
              {sample.label}
            </button>
          ))}
        </div>
        <pre className={styles.runnerReport} aria-live="polite">
          {runnerReport}
        </pre>
      </section>
      <div className={styles.editor}>
        <CodeEditor value={code} onChange={setCode} />
      </div>
    </div>
  )
}

export default WorkspacePage
