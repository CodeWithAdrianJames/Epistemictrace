import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../../api/ApiError.ts'
import { listActivities, type ActivitySummary } from '../../api/instructorActivitiesApi.ts'
import { useProtectedRequest } from '../../auth/useProtectedRequest.ts'
import styles from './ActivityListPage.module.css'
import { formatDate, STATUS_LABELS, testCaseCountLabel } from './activityLabels.ts'

const FALLBACK_DETAIL = 'Something went wrong. Please try again.'

type ListState =
  | { status: 'loading' }
  | { status: 'loaded'; activities: ActivitySummary[] }
  | { status: 'error'; message: string }

// Spec 09 R1: the instructor's activities, in the order the server sends them (most recently updated first).
function ActivityListPage() {
  const request = useProtectedRequest()
  const [state, setState] = useState<ListState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    request((token) => listActivities(token, controller.signal)).then(
      (activities) => {
        if (!controller.signal.aborted) {
          setState({ status: 'loaded', activities })
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ status: 'error', message: error instanceof ApiError ? error.detail : FALLBACK_DETAIL })
        }
      },
    )
    return () => controller.abort()
  }, [request])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.heading}>My activities</h1>
        <Link to="/instructor/activities/new" className={styles.newActivity}>
          New activity
        </Link>
      </div>
      {state.status === 'loading' && <p className={styles.message}>Loading activities…</p>}
      {state.status === 'error' && (
        <p role="alert" className={styles.pageError}>
          {state.message}
        </p>
      )}
      {state.status === 'loaded' &&
        (state.activities.length === 0 ? (
          <p className={styles.empty}>You haven't created any activities yet.</p>
        ) : (
          <ul aria-label="Activities" className={styles.list}>
            {state.activities.map((activity) => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </ul>
        ))}
    </div>
  )
}

function ActivityRow({ activity }: { activity: ActivitySummary }) {
  return (
    <li className={styles.row}>
      <div className={styles.rowText}>
        <h2 className={styles.title}>{activity.title}</h2>
        <p className={styles.details}>
          <span className={`${styles.status} ${styles[activity.status]}`}>{STATUS_LABELS[activity.status]}</span>
          <span>{testCaseCountLabel(activity.testCaseCount)}</span>
          <span>
            Updated <time dateTime={activity.updatedAt}>{formatDate(activity.updatedAt)}</time>
          </span>
        </p>
      </div>
      <Link
        to={`/instructor/activities/${activity.id}`}
        aria-label={`Edit ${activity.title}`}
        className={styles.edit}
      >
        Edit
      </Link>
    </li>
  )
}

export default ActivityListPage
