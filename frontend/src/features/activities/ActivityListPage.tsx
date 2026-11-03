import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../../api/ApiError.ts'
import { listActivities, type ActivityStatus, type ActivitySummary } from '../../api/instructorActivitiesApi.ts'
import { useProtectedRequest } from '../../auth/useProtectedRequest.ts'
import Icon, { type IconName } from '../../components/Icon.tsx'
import PageHeader from '../../components/PageHeader.tsx'
import PythonMark from '../../components/PythonMark.tsx'
import styles from './ActivityListPage.module.css'
import { formatDate, testCaseCountLabel } from './activityLabels.ts'
import StatusLabel from './StatusLabel.tsx'

const FALLBACK_DETAIL = 'Something went wrong. Please try again.'

type ListState =
  | { status: 'loading' }
  | { status: 'loaded'; activities: ActivitySummary[] }
  | { status: 'error'; message: string }

interface StatCard {
  label: string
  icon: IconName
  tone: 'purple' | 'green' | 'blue' | 'orange'
  count: (activities: readonly ActivitySummary[]) => number
}

function countStatus(status: ActivityStatus) {
  return (activities: readonly ActivitySummary[]) => activities.filter((activity) => activity.status === status).length
}

// Counts over the loaded list only; nothing here needs another request.
const STAT_CARDS: StatCard[] = [
  { label: 'Total activities', icon: 'file', tone: 'purple', count: (activities) => activities.length },
  { label: 'Published', icon: 'checkCircle', tone: 'green', count: countStatus('PUBLISHED') },
  { label: 'Drafts', icon: 'edit', tone: 'blue', count: countStatus('DRAFT') },
  { label: 'Archived', icon: 'clock', tone: 'orange', count: countStatus('ARCHIVED') },
]

// Spec 09 R1: the instructor's activities, in the order the server sends them (most recently updated first).
// Laid out as the instructor dashboard from ui/main screens/epistemictrace-instructor-dashboard.png.
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
      <PageHeader
        title="My activities"
        subtitle="Create, publish and manage your coding activities."
        actions={
          <Link to="/instructor/activities/new" className={styles.newActivity}>
            <Icon name="plus" className={styles.newActivityIcon} />
            New activity
          </Link>
        }
      />
      {state.status === 'loading' && <p className={styles.message}>Loading activities…</p>}
      {state.status === 'error' && (
        <p role="alert" className={styles.pageError}>
          {state.message}
        </p>
      )}
      {state.status === 'loaded' && (
        <>
          <dl className={styles.stats}>
            {STAT_CARDS.map((card) => (
              <div key={card.label} className={styles.stat}>
                <span className={`${styles.statIcon} ${styles[card.tone]}`} aria-hidden="true">
                  <Icon name={card.icon} />
                </span>
                <div className={styles.statText}>
                  <dt className={styles.statLabel}>{card.label}</dt>
                  <dd className={styles.statValue}>{card.count(state.activities)}</dd>
                </div>
              </div>
            ))}
          </dl>
          <section className={styles.panel} aria-labelledby="activity-list-title">
            <p id="activity-list-title" className={styles.panelTitle}>
              Your activities
            </p>
            {state.activities.length === 0 ? (
              <p className={styles.empty}>You haven't created any activities yet.</p>
            ) : (
              <ul aria-label="Activities" className={styles.list}>
                {state.activities.map((activity) => (
                  <ActivityRow key={activity.id} activity={activity} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function ActivityRow({ activity }: { activity: ActivitySummary }) {
  return (
    <li className={styles.row}>
      <span className={styles.rowIcon} aria-hidden="true">
        <PythonMark />
      </span>
      <div className={styles.rowText}>
        <h2 className={styles.title}>{activity.title}</h2>
        <p className={styles.details}>
          <StatusLabel status={activity.status} />
          <span className={styles.separator} aria-hidden="true">
            •
          </span>
          <span>
            Updated <time dateTime={activity.updatedAt}>{formatDate(activity.updatedAt)}</time>
          </span>
        </p>
      </div>
      <span className={styles.count}>{testCaseCountLabel(activity.testCaseCount)}</span>
      <Link
        to={`/instructor/activities/${activity.id}`}
        aria-label={`Edit ${activity.title}`}
        className={styles.edit}
      >
        <Icon name="edit" className={styles.editIcon} />
        Edit
      </Link>
    </li>
  )
}

export default ActivityListPage
