import { useId, type FormEvent, type ReactNode } from 'react'
import type { FieldErrors } from '../../auth/authForms.ts'
import styles from './ActivityForm.module.css'
import type { ActivityField, ActivityFormValues } from './activityForm.ts'

interface ActivityFormProps {
  values: ActivityFormValues
  fieldErrors: FieldErrors<ActivityField>
  submitLabel: string
  submitDisabled: boolean
  onChange: (field: ActivityField, value: string) => void
  onSubmit: () => void
}

// Spec 09 R2/R3: the title, problem statement and starter code fields shared by the new and edit pages.
function ActivityForm({ values, fieldErrors, submitLabel, submitDisabled, onChange, onSubmit }: ActivityFormProps) {
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

interface ControlProps {
  id: string
  'aria-invalid': true | undefined
  'aria-describedby': string | undefined
}

interface FieldProps {
  label: string
  error: string | undefined
  children: (props: ControlProps) => ReactNode
}

// One labelled control with its error underneath, linked through aria-describedby.
function Field({ label, error, children }: FieldProps) {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? errorId : undefined,
      })}
      {error && (
        <p id={errorId} className={styles.fieldError}>
          {error}
        </p>
      )}
    </div>
  )
}

export default ActivityForm
