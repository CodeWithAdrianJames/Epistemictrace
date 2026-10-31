import { useId, useState, type FormEvent } from 'react'
import { ApiError } from '../../api/ApiError.ts'
import { submitReflection, type Breaker } from '../../api/sessionsApi.ts'
import { useProtectedRequest } from '../../auth/useProtectedRequest.ts'
import styles from './ReflectionForm.module.css'

const FALLBACK_DETAIL = 'Something went wrong. Please try again.'

interface ReflectionFormProps {
  sessionId: number
  // From the breaker payload (spec 22 R7); never hard-coded.
  minLength: number
  // 201: the server's new breaker state (COOLDOWN).
  onSubmitted: (breaker: Breaker) => void
  // 409: the server says the runner is no longer paused.
  onNotLocked: () => void
}

type Field = 'hypothesis' | 'plannedFix'

// Spec 25 R1–R5, ui-context.md → Locked panel copy. Part of the page, not a modal (R6); the typed
// text lives in component state only (R5).
function ReflectionForm({ sessionId, minLength, onSubmitted, onNotLocked }: ReflectionFormProps) {
  const request = useProtectedRequest()
  const [hypothesis, setHypothesis] = useState('')
  const [plannedFix, setPlannedFix] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const ready = hypothesis.trim().length >= minLength && plannedFix.trim().length >= minLength

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ready || submitting) return
    setSubmitting(true)
    setFieldErrors({})
    setFormError(null)
    try {
      const response = await request((token) => submitReflection(token, sessionId, { hypothesis, plannedFix }))
      onSubmitted(response.breaker)
    } catch (error: unknown) {
      setSubmitting(false)
      if (error instanceof ApiError && error.status === 409) {
        onNotLocked()
        return
      }
      if (error instanceof ApiError && error.status === 400 && hasFieldError(error)) {
        setFieldErrors({ hypothesis: error.fieldErrors.hypothesis, plannedFix: error.fieldErrors.plannedFix })
        return
      }
      setFormError(error instanceof ApiError ? error.detail : FALLBACK_DETAIL)
    }
  }

  return (
    <form className={styles.form} onSubmit={(event) => void handleSubmit(event)} noValidate>
      {formError !== null && (
        <p role="alert" className={styles.formError}>
          {formError}
        </p>
      )}
      <ReflectionField
        label="What do you think is wrong?"
        value={hypothesis}
        onChange={setHypothesis}
        minLength={minLength}
        error={fieldErrors.hypothesis}
      />
      <ReflectionField
        label="What will you try next?"
        value={plannedFix}
        onChange={setPlannedFix}
        minLength={minLength}
        error={fieldErrors.plannedFix}
      />
      <button type="submit" className={styles.submit} disabled={!ready || submitting} aria-disabled={!ready || submitting}>
        {submitting ? 'Saving…' : 'Continue'}
      </button>
    </form>
  )
}

interface ReflectionFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  minLength: number
  error: string | undefined
}

// The counter shows trimmed characters against the minimum until the minimum is reached (R1).
function ReflectionField({ label, value, onChange, minLength, error }: ReflectionFieldProps) {
  const id = useId()
  const length = value.trim().length
  const describedBy = [length < minLength ? `${id}-count` : null, error ? `${id}-error` : null].filter(Boolean).join(' ')

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <textarea
        id={id}
        className={styles.textarea}
        value={value}
        rows={3}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
      />
      {length < minLength && (
        <p id={`${id}-count`} className={styles.counter}>
          {length} / {minLength} characters
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  )
}

function hasFieldError(error: ApiError): boolean {
  return error.fieldErrors.hypothesis !== undefined || error.fieldErrors.plannedFix !== undefined
}

export default ReflectionForm
