import type { FormEvent } from 'react'
import type { FieldErrors } from '../../auth/authForms.ts'
import styles from './ActivityForm.module.css'
import type { ActivityField, ActivityFormValues } from './activityForm.ts'
import Field from './Field.tsx'

interface ActivityFormProps {
  values: ActivityFormValues
  fieldErrors: FieldErrors<ActivityField>
  submitLabel: string
  submitDisabled: boolean
  // Spec 09 R5: archived activities show their fields read-only; they stay focusable for copying.
  readOnly?: boolean
  onChange: (field: ActivityField, value: string) => void
  onSubmit: () => void
}

// Spec 09 R2/R3: the title, problem statement and starter code fields shared by the new and edit pages.
function ActivityForm({
  values,
  fieldErrors,
  submitLabel,
  submitDisabled,
  readOnly = false,
  onChange,
  onSubmit,
}: ActivityFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      <Field label="Title" error={fieldErrors.title}>
        {(props) => (
          <input
            {...props}
            name="title"
            type="text"
            autoComplete="off"
            readOnly={readOnly}
            value={values.title}
            className={styles.input}
            onChange={(event) => {
              onChange('title', event.target.value)
            }}
          />
        )}
      </Field>
      <Field label="Problem statement" error={fieldErrors.problemStatement}>
        {(props) => (
          <textarea
            {...props}
            name="problemStatement"
            rows={10}
            readOnly={readOnly}
            value={values.problemStatement}
            className={styles.input}
            onChange={(event) => {
              onChange('problemStatement', event.target.value)
            }}
          />
        )}
      </Field>
      <Field label="Starter code" error={fieldErrors.starterCode}>
        {(props) => (
          <textarea
            {...props}
            name="starterCode"
            rows={12}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            wrap="off"
            readOnly={readOnly}
            value={values.starterCode}
            className={`${styles.input} ${styles.code}`}
            onChange={(event) => {
              onChange('starterCode', event.target.value)
            }}
          />
        )}
      </Field>
      <button type="submit" className={styles.submit} disabled={submitDisabled}>
        {submitLabel}
      </button>
    </form>
  )
}

export default ActivityForm
