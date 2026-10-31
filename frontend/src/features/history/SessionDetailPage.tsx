import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../../api/ApiError.ts'
import { getSession, type SessionDetail } from '../../api/historyApi.ts'
import { useProtectedRequest } from '../../auth/useProtectedRequest.ts'
import styles from './History.module.css'
import { formatDateTime } from './formatDateTime.ts'
import { formatDuration } from './formatDuration.ts'

const FALLBACK_DETAIL = 'Something went wrong. Please try again.'

type DetailState =
  | { status: 'loading' }
  | { status: 'loaded'; session: SessionDetail }
  | { status: 'not_available' }
  | { status: 'error'; message: string }

// Spec 27 R4–R7: one session and its reflections. Keyed by id, so another session starts from a fresh load.
function SessionDetailPage() {
  const { sessionId } = useParams()
  const id = parseSessionId(sessionId)
  return id === null ? <NotAvailable /> : <SessionLoader key={id} sessionId={id} />
}

function SessionLoader({ sessionId }: { sessionId: number }) {
  const request = useProtectedRequest()
  const [state, setState] = useState<DetailState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    request((token) => getSession(token, sessionId, controller.signal)).then(
      (session) => {
        if (!controller.signal.aborted) {
          setState({ status: 'loaded', session })
        }
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        // Another student's session (403) and an unknown id (404) look the same to the student.
        if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
          setState({ status: 'not_available' })
        } else {
          setState({ status: 'error', message: error instanceof ApiError ? error.detail : FALLBACK_DETAIL })
        }
      },
    )
    return () => controller.abort()
  }, [request, sessionId])

  switch (state.status) {
    case 'loading':
      return <p className={styles.message}>Loading session…</p>
    case 'not_available':
      return <NotAvailable />
    case 'error':
      return (
        <p role="alert" className={styles.pageError}>
          {state.message}
        </p>
      )
    case 'loaded':
      return <Detail session={state.session} />
  }
}

function Detail({ session }: { session: SessionDetail }) {
  return (
    <div className={styles.page}>
      <Link to="/student/history" className={styles.back}>
        Back to My history
      </Link>
      <h1 className={styles.heading}>{session.activityTitle}</h1>
      <dl className={styles.facts}>
        <div>
          <dt>Started</dt>
          <dd>
            <time dateTime={session.startedAt}>{formatDateTime(session.startedAt)}</time>
          </dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{formatDuration(session.durationSeconds)}</dd>
        </div>
        <div>
          <dt>Test runs</dt>
          <dd>{session.runCount}</dd>
        </div>
      </dl>
      <h2 className={styles.subheading}>Reflections</h2>
      {session.reflections.length === 0 ? (
        <p className={styles.message}>No pauses in this session.</p>
      ) : (
        <ul aria-label="Reflections" className={styles.reflections}>
          {session.reflections.map((reflection, index) => (
            <li key={`${reflection.submittedAt}-${index}`} className={styles.reflection}>
              <time dateTime={reflection.submittedAt} className={styles.reflectionTime}>
                {formatDateTime(reflection.submittedAt)}
              </time>
              <h3 className={styles.reflectionLabel}>What I thought was wrong</h3>
              <p className={styles.reflectionText}>{reflection.hypothesis}</p>
              <h3 className={styles.reflectionLabel}>What I planned to try</h3>
              <p className={styles.reflectionText}>{reflection.plannedFix}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function NotAvailable() {
  return (
    <div className={styles.empty}>
      <p className={styles.message}>This session isn't available.</p>
      <Link to="/student/history">Back to My history</Link>
    </div>
  )
}

// Route params are strings; only a canonical positive safe integer is a session id.
function parseSessionId(param: string | undefined): number | null {
  if (param === undefined || !/^[1-9]\d*$/.test(param)) {
    return null
  }
  const id = Number(param)
  return Number.isSafeInteger(id) ? id : null
}

export default SessionDetailPage
