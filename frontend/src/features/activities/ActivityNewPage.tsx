import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError } from '../../api/ApiError.ts'
import { createActivity } from '../../api/instructorActivitiesApi.ts'
import { formErrorsFrom, hasErrors, type FieldErrors } from '../../auth/authForms.ts'
import { useProtectedRequest } from '../../auth/useProtectedRequest.ts'
import Icon from '../../components/Icon.tsx'
import PageHeader from '../../components/PageHeader.tsx'
import ActivityForm from './ActivityForm.tsx'
import styles from './ActivityPage.module.css'
import {
  ACTIVITY_FIELDS,
  EMPTY_ACTIVITY,
  toActivityRequest,
  validateActivity,
  type ActivityField,
  type ActivityFormValues,
} from './activityForm.ts'

// Spec 09 R2: create a draft activity, then continue on its edit page.
function ActivityNewPage() {
  const request = useProtectedRequest()
  const navigate = useNavigate()
  const [values, setValues] = useState<ActivityFormValues>(EMPTY_ACTIVITY)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<ActivityField>>({})
  const [pageError, setPageError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function setField(field: ActivityField, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  async function submit(form: ActivityFormValues) {
    setSubmitting(true)
    try {
      const activity = await request((token) => createActivity(token, toActivityRequest(form)))
      // replace: Back from the edit page returns to the list, not to an empty form.
      navigate(`/instructor/activities/${activity.id}`, { replace: true })
    } catch (error: unknown) {
      // useProtectedRequest has already logged out and left the page.
      if (error instanceof ApiError && error.status === 401) {
        return
      }
      setSubmitting(false)
      const mapped = formErrorsFrom(error, ACTIVITY_FIELDS)
      setFieldErrors(mapped.fieldErrors)
      setPageError(mapped.formError)
    }
  }

  function handleSubmit() {
    if (submitting) {
      return
    }
    const errors = validateActivity(values)
    setFieldErrors(errors)
    setPageError(null)
    if (hasErrors(errors)) {
      return
    }
    void submit(values)
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="New activity"
        subtitle="Write the problem, add starter code, then add test cases after you create it."
        actions={
          <Link to="/instructor/activities" className={styles.back}>
            <Icon name="arrowLeft" className={styles.backIcon} />
            Back to My activities
          </Link>
        }
      />
      <section className={styles.panel}>
        {pageError && (
          <p role="alert" className={styles.pageError}>
            {pageError}
          </p>
        )}
        <ActivityForm
          values={values}
          fieldErrors={fieldErrors}
          submitLabel="Create"
          submitDisabled={submitting}
          onChange={setField}
          onSubmit={handleSubmit}
        />
      </section>
    </div>
  )
}

export default ActivityNewPage
