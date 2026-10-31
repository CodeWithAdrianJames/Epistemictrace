import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../../api/ApiError.ts'
import { listActivities, type ActivitySummary } from '../../api/activitiesApi.ts'
import { useProtectedRequest } from '../../auth/useProtectedRequest.ts'
import styles from './StudentActivityListPage.module.css'

const FALLBACK_DETAIL = 'Something went wrong. Please try again.'

type ListState =
  | { status: 'loading' }
  | { status: 'loaded'; activities: ActivitySummary[] }
  | { status: 'error'; message: string }

// Spec 10 R2/R3: published activities, in the order the server returns them (by title).
function StudentActivityListPage() {
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
      <h1 className={styles.heading}>Activities</h1>
      {state.status === 'loading' && <p className={styles.message}>Loading activities…</p>}
      {state.status === 'error' && (
        <p role="alert" className={styles.pageError}>
          {state.message}
        </p>
      )}
      {state.status === 'loaded' &&
        (state.activities.length === 0 ? (
          <p className={styles.empty}>No activities are available yet. Check back later.</p>
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
      <Link to={`/student/activities/${activity.id}`} className={styles.rowLink}>
        <h2 className={styles.title}>{activity.title}</h2>
        <span className={styles.count}>{testCountLabel(activity.testCaseCount)}</span>
      </Link>
    </li>
  )
}

function testCountLabel(count: number): string {
  return count === 1 ? '1 test' : `${count} tests`
}

export default StudentActivityListPage
