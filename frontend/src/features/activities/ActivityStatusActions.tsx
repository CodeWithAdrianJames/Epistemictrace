import { useId, useState } from 'react'
import { ApiError } from '../../api/ApiError.ts'
import { archiveActivity, publishActivity, type ActivityDetail } from '../../api/instructorActivitiesApi.ts'
import { useProtectedRequest } from '../../auth/useProtectedRequest.ts'
import formStyles from './ActivityForm.module.css'
import pageStyles from './ActivityPage.module.css'
import styles from './ActivityStatusActions.module.css'

const FALLBACK_DETAIL = 'Something went wrong. Please try again.'
const PUBLISH_HINT = 'Add at least one test case'
const ARCHIVED_NOTE = "Archived activities can't be edited."
const ARCHIVE_PROMPT = "Archive this activity? Archived activities can't be edited or published again."

interface ActivityStatusActionsProps {
  activity: ActivityDetail
  onStatusChange: (activity: ActivityDetail) => void
}

// Spec 09 R5: Publish and Archive per status. Errors land at the top of this section (R6),
// and the new status comes from the server's response (R7).
function ActivityStatusActions({ activity, onStatusChange }: ActivityStatusActionsProps) {
  const request = useProtectedRequest()
  const headingId = useId()
  const hintId = useId()
  const [sectionError, setSectionError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const canPublish = activity.testCases.length > 0

  async function run(action: (token: string, activityId: number) => Promise<ActivityDetail>) {
    setPending(true)
    setSectionError(null)
    try {
      const updated = await request((token) => action(token, activity.id))
      setPending(false)
      onStatusChange(updated)
    } catch (error: unknown) {
      // useProtectedRequest has already logged out and left the page.
      if (error instanceof ApiError && error.status === 401) {
        return
      }
      setPending(false)
      setSectionError(error instanceof ApiError ? error.detail : FALLBACK_DETAIL)
    }
  }

  function handlePublish() {
    if (pending || !canPublish) {
      return
    }
    void run(publishActivity)
  }

  function handleArchive() {
    if (pending || !window.confirm(ARCHIVE_PROMPT)) {
      return
    }
    void run(archiveActivity)
  }

  return (
    <section aria-labelledby={headingId} className={pageStyles.panel}>
      <h2 id={headingId} className={pageStyles.sectionHeading}>
        Status
      </h2>
      {sectionError && (
        <p role="alert" className={pageStyles.pageError}>
          {sectionError}
        </p>
      )}
      {activity.status === 'ARCHIVED' ? (
        <p className={pageStyles.message}>{ARCHIVED_NOTE}</p>
      ) : (
        <div className={styles.actions}>
          {activity.status === 'DRAFT' && (
            <>
              <button
                type="button"
                className={formStyles.submit}
                disabled={pending || !canPublish}
                aria-describedby={canPublish ? undefined : hintId}
                onClick={handlePublish}
              >
                Publish
              </button>
              {!canPublish && (
                <span id={hintId} className={styles.hint}>
                  {PUBLISH_HINT}
                </span>
              )}
            </>
          )}
          <button type="button" className={formStyles.secondary} disabled={pending} onClick={handleArchive}>
            Archive
          </button>
        </div>
      )}
    </section>
  )
}

export default ActivityStatusActions
