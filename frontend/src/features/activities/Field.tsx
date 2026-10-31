import { useId, type ReactNode } from 'react'
import styles from './ActivityForm.module.css'

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
// Shared by the activity form and the test case editor.
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

export default Field
