import { useEffect, useId, useState } from 'react'
import { useParams } from 'react-router'
import { ApiError } from '../../api/ApiError.ts'
import { getActivity, updateActivity, type ActivityDetail } from '../../api/instructorActivitiesApi.ts'
import { formErrorsFrom, hasErrors, type FieldErrors } from '../../auth/authForms.ts'
import { useProtectedRequest } from '../../auth/useProtectedRequest.ts'
import ActivityForm from './ActivityForm.tsx'
import styles from './ActivityPage.module.css'
import {
  ACTIVITY_FIELDS,
  isChanged,
  toActivityRequest,
  validateActivity,
  valuesFrom,
  type ActivityField,
  type ActivityFormValues,
} from './activityForm.ts'
import StatusLabel from './StatusLabel.tsx'

const FALLBACK_DETAIL = 'Something went wrong. Please try again.'
// Same text the server sends for a missing activity, so a malformed URL reads like an unknown id.
const NOT_FOUND_DETAIL = 'Activity not found.'

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; activity: ActivityDetail }
  | { status: 'error'; message: string }

// Spec 09 R3: the edit page. Keyed by id, so moving to another activity starts from a fresh load.
function ActivityEditPage() {
  const { activityId } = useParams()
  const id = parseActivityId(activityId)

  return id === null ? (
    <EditLayout state={{ status: 'error', message: NOT_FOUND_DETAIL }} onSaved={() => {}} />
  ) : (
    <ActivityEditor key={id} activityId={id} />
  )
}

function ActivityEditor({ activityId }: { activityId: number }) {
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
        if (!controller.signal.aborted) {
          setState({ status: 'error', message: error instanceof ApiError ? error.detail : FALLBACK_DETAIL })
        }
      },
    )
    return () => controller.abort()
  }, [request, activityId])

  // R7: the page shows what the server returned, never an optimistic copy.
  return <EditLayout state={state} onSaved={(activity) => setState({ status: 'loaded', activity })} />
}

interface EditLayoutProps {
  state: LoadState
  onSaved: (activity: ActivityDetail) => void
}

function EditLayout({ state, onSaved }: EditLayoutProps) {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.heading}>Edit activity</h1>
        {state.status === 'loaded' && <StatusLabel status={state.activity.status} />}
      </div>
      {state.status === 'loading' && <p className={styles.message}>Loading activity…</p>}
      {state.status === 'error' && (
        <p role="alert" className={styles.pageError}>
          {state.message}
        </p>
      )}
      {state.status === 'loaded' && <DetailsSection activity={state.activity} onSaved={onSaved} />}
    </div>
  )
}

interface DetailsSectionProps {
  activity: ActivityDetail
  onSaved: (activity: ActivityDetail) => void
}

// The top section: title, problem statement and starter code with Save changes (R3, R6).
function DetailsSection({ activity, onSaved }: DetailsSectionProps) {
  const request = useProtectedRequest()
  const headingId = useId()
  const [values, setValues] = useState<ActivityFormValues>(() => valuesFrom(activity))
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<ActivityField>>({})
  const [sectionError, setSectionError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const changed = isChanged(values, valuesFrom(activity))

  function setField(field: ActivityField, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setSaved(false)
  }

  async function submit(form: ActivityFormValues) {
    setSubmitting(true)
    try {
      const updated = await request((token) => updateActivity(token, activity.id, toActivityRequest(form)))
      setValues(valuesFrom(updated))
      setSaved(true)
      setSubmitting(false)
      onSaved(updated)
    } catch (error: unknown) {
      // useProtectedRequest has already logged out and left the page.
      if (error instanceof ApiError && error.status === 401) {
        return
      }
      setSubmitting(false)
      // A 409 (for example an archived activity) has no field errors, so its detail lands at the top.
      const mapped = formErrorsFrom(error, ACTIVITY_FIELDS)
      setFieldErrors(mapped.fieldErrors)
      setSectionError(mapped.formError)
    }
  }

  function handleSubmit() {
    if (submitting || !changed) {
      return
    }
    const errors = validateActivity(values)
    setFieldErrors(errors)
    setSectionError(null)
    setSaved(false)
    if (hasErrors(errors)) {
      return
    }
    void submit(values)
  }

  return (
    <section aria-labelledby={headingId} className={styles.panel}>
      <h2 id={headingId} className={styles.sectionHeading}>
        Details
      </h2>
      {sectionError && (
        <p role="alert" className={styles.pageError}>
          {sectionError}
        </p>
      )}
      {saved && (
        <p role="status" className={styles.saved}>
          Changes saved.
        </p>
      )}
      <ActivityForm
        values={values}
        fieldErrors={fieldErrors}
        submitLabel="Save changes"
        submitDisabled={submitting || !changed}
        onChange={setField}
        onSubmit={handleSubmit}
      />
    </section>
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

export default ActivityEditPage
