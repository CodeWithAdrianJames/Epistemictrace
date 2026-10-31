import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../../api/ApiError.ts'
import { getActivity, type ActivityDetail } from '../../api/activitiesApi.ts'
import { useAuth } from '../../auth/AuthProvider.tsx'
import { useProtectedRequest } from '../../auth/useProtectedRequest.ts'
import ConsentNotice from '../consent/ConsentNotice.tsx'
import { useConsent } from '../consent/useConsent.ts'
import CodeEditor, { type EditorChange } from './CodeEditor.tsx'
import ProblemPanel from './ProblemPanel.tsx'
import ResultsPanel from './ResultsPanel.tsx'
import RunButton, { type RunButtonState } from './RunButton.tsx'
import styles from './WorkspacePage.module.css'
import { useDraft } from './useDraft.ts'
import { usePythonRunner, type RunnerStatus } from './usePythonRunner.ts'
import { useRunTests, type RunState } from './useRunTests.ts'

const FALLBACK_DETAIL = 'Something went wrong. Please try again.'

export type EditorChangeListener = (value: string, change: EditorChange) => void

interface WorkspacePageProps {
  // R4: every editor change, for telemetry (spec 17), without changing CodeEditor.
  onEditorChange?: EditorChangeListener
}

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; activity: ActivityDetail }
  | { status: 'not_found' }
  | { status: 'error'; message: string }

// Spec 14: the coding workspace. Keyed by id, so moving to another activity starts from a fresh load.
function WorkspacePage({ onEditorChange }: WorkspacePageProps) {
  const { activityId } = useParams()
  const id = parseActivityId(activityId)

  return id === null ? (
    <NotAvailable />
  ) : (
    <ActivityLoader key={id} activityId={id} onEditorChange={onEditorChange} />
  )
}

function ActivityLoader({ activityId, onEditorChange }: { activityId: number } & WorkspacePageProps) {
  const request = useProtectedRequest()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    request((token) => getActivity(token, activityId, controller.signal)).then(
      (activity) => {
        if (!controller.signal.aborted) {
          setState({ status: 'loaded', activity })
        }
      },
      (error: unknown) => {
        if (controller.signal.aborted) {
          return
        }
        // R1: draft and archived activities are 404 for students, like unknown ids.
        if (error instanceof ApiError && error.status === 404) {
          setState({ status: 'not_found' })
        } else {
          setState({ status: 'error', message: error instanceof ApiError ? error.detail : FALLBACK_DETAIL })
        }
      },
    )
    return () => controller.abort()
  }, [request, activityId])

  switch (state.status) {
    case 'loading':
      return <p className={styles.message}>Loading activity…</p>
    case 'not_found':
      return <NotAvailable />
    case 'error':
      return (
        <p role="alert" className={styles.pageError}>
          {state.message}
        </p>
      )
    case 'loaded':
      return <Workspace activity={state.activity} onEditorChange={onEditorChange} />
  }
}

function Workspace({ activity, onEditorChange }: { activity: ActivityDetail } & WorkspacePageProps) {
  const { user } = useAuth()
  // RequireRole only renders this page for a signed-in student, so 'local' is a fallback only.
  const [code, setCode] = useDraft(user ? user.id : 'local', activity.id, activity.starterCode)
  const { runner, status: runnerStatus } = usePythonRunner()
  const { state: runState, lastReport, run } = useRunTests(code, activity.testCases, runner)
  // Spec 15 R3/R7: mounted only here, after the activity has loaded. Spec 17 starts tracking on consent.status === 'accepted'.
  const consent = useConsent()

  const handleChange = useCallback(
    (value: string, change: EditorChange) => {
      setCode(value)
      onEditorChange?.(value, change)
    },
    [setCode, onEditorChange],
  )

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{activity.title}</h1>
        <RunButton state={runButtonState(runnerStatus, runState)} onRun={() => void run()} />
      </header>
      <ConsentNotice consent={consent} />
      <div className={styles.regions}>
        <div className={styles.problem}>
          <ProblemPanel problemStatement={activity.problemStatement} testCases={activity.testCases} />
        </div>
        <section className={styles.editor} aria-label="Editor">
          <CodeEditor value={code} onChange={handleChange} />
        </section>
        <div className={styles.results}>
          <ResultsPanel report={lastReport} testCases={activity.testCases} />
        </div>
      </div>
    </div>
  )
}

function runButtonState(runnerStatus: RunnerStatus, runState: RunState): RunButtonState {
  if (runnerStatus === 'failed') return 'failed'
  if (runnerStatus === 'warming') return 'preparing'
  return runState === 'running' ? 'running' : 'ready'
}

function NotAvailable() {
  return (
    <div className={styles.notAvailable}>
      <p className={styles.message}>This activity isn't available.</p>
      <Link to="/student/activities">Back to Activities</Link>
    </div>
  )
}

// Route params are strings; only a canonical positive safe integer is an activity id.
function parseActivityId(param: string | undefined): number | null {
  if (param === undefined || !/^[1-9]\d*$/.test(param)) {
    return null
  }
  const id = Number(param)
  return Number.isSafeInteger(id) ? id : null
}

export default WorkspacePage
