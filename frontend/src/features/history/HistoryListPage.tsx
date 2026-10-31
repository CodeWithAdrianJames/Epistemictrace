import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../../api/ApiError.ts'
import { listSessions, type HistoryItem, type HistoryPage } from '../../api/historyApi.ts'
import { useProtectedRequest } from '../../auth/useProtectedRequest.ts'
import styles from './History.module.css'
import { formatDateTime } from './formatDateTime.ts'
import { formatDuration } from './formatDuration.ts'

const FALLBACK_DETAIL = 'Something went wrong. Please try again.'

type ListState =
  | { status: 'loading' }
  | { status: 'loaded'; page: HistoryPage }
  | { status: 'error'; message: string }

// Spec 27 R2, R3, R7: the student's sessions, newest first, a page at a time. No SDI (R6).
function HistoryListPage() {
  const request = useProtectedRequest()
  const [pageNumber, setPageNumber] = useState(0)
  const [state, setState] = useState<ListState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    request((token) => listSessions(token, pageNumber, controller.signal)).then(
      (page) => {
        if (!controller.signal.aborted) {
          setState({ status: 'loaded', page })
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ status: 'error', message: error instanceof ApiError ? error.detail : FALLBACK_DETAIL })
        }
      },
    )
    return () => controller.abort()
  }, [request, pageNumber])

  function goTo(page: number) {
    setState({ status: 'loading' })
    setPageNumber(page)
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>My history</h1>
      {state.status === 'loading' && <p className={styles.message}>Loading your sessions…</p>}
      {state.status === 'error' && (
        <p role="alert" className={styles.pageError}>
          {state.message}
        </p>
      )}
      {state.status === 'loaded' && <Loaded page={state.page} onPage={goTo} />}
    </div>
  )
}

function Loaded({ page, onPage }: { page: HistoryPage; onPage: (page: number) => void }) {
  if (page.totalItems === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.message}>You haven't worked on any activities yet.</p>
        <Link to="/student/activities">Go to Activities</Link>
      </div>
    )
  }
  const hasPrevious = page.page > 0
  const hasNext = (page.page + 1) * page.size < page.totalItems

  return (
    <>
      <ul aria-label="Sessions" className={styles.list}>
        {page.items.map((item) => (
          <SessionRow key={item.sessionId} item={item} />
        ))}
      </ul>
      {(hasPrevious || hasNext) && (
        <nav aria-label="Pages" className={styles.pager}>
          <button type="button" className={styles.pagerButton} disabled={!hasPrevious} onClick={() => onPage(page.page - 1)}>
            Previous
          </button>
          <button type="button" className={styles.pagerButton} disabled={!hasNext} onClick={() => onPage(page.page + 1)}>
            Next
          </button>
        </nav>
      )}
    </>
  )
}

function SessionRow({ item }: { item: HistoryItem }) {
  return (
    <li className={styles.row}>
      <Link to={`/student/history/${item.sessionId}`} className={styles.rowLink}>
        <span className={styles.rowTitle}>{item.activityTitle}</span>
        <span className={styles.rowMeta}>
          <time dateTime={item.startedAt}>{formatDateTime(item.startedAt)}</time>
          <span>{formatDuration(item.durationSeconds)}</span>
          <span>{reflectionsLabel(item.reflectionCount)}</span>
        </span>
      </Link>
    </li>
  )
}

function reflectionsLabel(count: number): string {
  return count === 1 ? '1 reflection' : `${count} reflections`
}

export default HistoryListPage
