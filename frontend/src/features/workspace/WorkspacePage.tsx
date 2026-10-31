import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../../api/ApiError.ts'
import { getActivity, type ActivityDetail } from '../../api/activitiesApi.ts'
import { useAuth } from '../../auth/AuthProvider.tsx'
import { useProtectedRequest } from '../../auth/useProtectedRequest.ts'
import type { Breaker, BreakerStatus } from '../../api/sessionsApi.ts'
import LockedPanel from '../breaker/LockedPanel.tsx'
import ReflectionForm from '../breaker/ReflectionForm.tsx'
import { useBreakerState } from '../breaker/useBreakerState.ts'
import { SERVER_UNREACHABLE_MESSAGE, useRunGate } from '../breaker/useRunGate.ts'
import ConsentNotice from '../consent/ConsentNotice.tsx'
import { useConsent } from '../consent/useConsent.ts'
import { TRACKING_UNAVAILABLE_MESSAGE, useTelemetrySession } from '../telemetry/useTelemetrySession.ts'
import CodeEditor, { type EditorChange } from './CodeEditor.tsx'
import ProblemPanel from './ProblemPanel.tsx'
import ResultsPanel from './ResultsPanel.tsx'
import RunButton, { type RunButtonState } from './RunButton.tsx'
import StruggleBadge from './StruggleBadge.tsx'
import styles from './WorkspacePage.module.css'
import { useDraft } from './useDraft.ts'
import { usePythonRunner, type RunnerStatus } from './usePythonRunner.ts'
import { useRunTests, type RunState } from './useRunTests.ts'
import { useStruggleLevel } from './useStruggleLevel.ts'

const FALLBACK_DETAIL = 'Something went wrong. Please try again.'

// ui-context.md → Breaker Panel: the top-bar notice during cooldown.
export const COOLDOWN_NOTICE = 'Tests are running again. Keep going step by step.'

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
  const { state: runState, lastReport, run, onReportReady } = useRunTests(code, activity.testCases, runner)
  // Spec 15 R3/R7: mounted only here, after the activity has loaded.
  const consent = useConsent()
  // Spec 17 R4/R5: tracking starts only when consent.status is 'accepted'.
  const telemetry = useTelemetrySession({ activityId: activity.id, consentStatus: consent.status })
  const { recordEdit, recordRun, onBatchResponse } = telemetry
  // Spec 23: the server's breaker state, and the wait for the server after each run (fail-open after 5 s).
  const breaker = useBreakerState({ startResponse: telemetry.startResponse, onBatchResponse })
  const gate = useRunGate(recordRun, telemetry.sessionId !== null)
  // Spec 28: the latest level from the server; no responses (no badge) while tracking is off.
  const struggleLevel = useStruggleLevel(onBatchResponse)
  const { handleReport } = gate
  const { apply: applyBreaker, state: breakerState, reflectionMinLength } = breaker
  // Spec 25 R3: after a reflection unlocks the runner, focus goes back to Run tests.
  const runButtonRef = useRef<HTMLButtonElement>(null)
  const focusRunAfterUnlockRef = useRef(false)

  useEffect(() => onReportReady(handleReport), [onReportReady, handleReport])

  useEffect(() => {
    if (focusRunAfterUnlockRef.current && breakerState !== 'LOCKED') {
      focusRunAfterUnlockRef.current = false
      runButtonRef.current?.focus()
    }
  }, [breakerState])

  const handleReflected = useCallback(
    (next: Breaker) => {
      focusRunAfterUnlockRef.current = true
      applyBreaker(next)
    },
    [applyBreaker],
  )

  // Spec 25 R4: a 409 means the server no longer pauses this session; show it unlocked until the
  // next response says otherwise.
  const handleNotLocked = useCallback(() => {
    focusRunAfterUnlockRef.current = true
    applyBreaker({ state: 'UNLOCKED', cooldownEndsAt: null, reflectionMinLength })
  }, [applyBreaker, reflectionMinLength])

  const handleChange = useCallback(
    (value: string, change: EditorChange) => {
      setCode(value)
      recordEdit(change)
      onEditorChange?.(value, change)
    },
    [setCode, recordEdit, onEditorChange],
  )

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{activity.title}</h1>
        <div className={styles.actions}>
          <StruggleBadge level={struggleLevel} />
          {breaker.state === 'COOLDOWN' && (
            <p role="status" className={styles.cooldownNotice}>
              {COOLDOWN_NOTICE}
            </p>
          )}
          <RunButton
            ref={runButtonRef}
            state={runButtonState(runnerStatus, runState, gate.waiting, breaker.state)}
            onRun={() => void run()}
          />
        </div>
      </header>
      <ConsentNotice consent={consent} />
      {telemetry.unavailable && (
        <p role="status" className={styles.trackingNotice}>
          {TRACKING_UNAVAILABLE_MESSAGE}
        </p>
      )}
      {gate.unreachable && (
        <p role="status" className={styles.trackingNotice}>
          {SERVER_UNREACHABLE_MESSAGE}
        </p>
      )}
      <div className={styles.regions}>
        <div className={styles.problem}>
          <ProblemPanel problemStatement={activity.problemStatement} testCases={activity.testCases} />
        </div>
        <section className={styles.editor} aria-label="Editor">
          <CodeEditor value={code} onChange={handleChange} />
        </section>
        <div className={styles.results}>
          {breaker.state === 'LOCKED' && telemetry.sessionId !== null && (
            <LockedPanel>
              <ReflectionForm
                sessionId={telemetry.sessionId}
                minLength={reflectionMinLength}
                onSubmitted={handleReflected}
                onNotLocked={handleNotLocked}
              />
            </LockedPanel>
          )}
          <ResultsPanel report={lastReport} testCases={activity.testCases} />
        </div>
      </div>
    </div>
  )
}

// Spec 23 R3: a locked runner shows its reason even while Python is still loading.
function runButtonState(
  runnerStatus: RunnerStatus,
  runState: RunState,
  waitingForServer: boolean,
  breakerState: BreakerStatus,
): RunButtonState {
  if (runnerStatus === 'failed') return 'failed'
  if (breakerState === 'LOCKED') return 'locked'
  if (runnerStatus === 'warming') return 'preparing'
  if (runState === 'running') return 'running'
  return waitingForServer ? 'waiting' : 'ready'
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
