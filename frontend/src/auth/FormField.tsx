import { useId } from 'react'
import styles from './AuthForm.module.css'

interface FormFieldProps {
  label: string
  name: string
  type: 'text' | 'email' | 'password'
  autoComplete: string
  value: string
  error?: string
  onChange: (value: string) => void
}

// One labelled input with its error underneath, linked through aria-describedby.
function FormField({ label, name, type, autoComplete, value, error, onChange }: FormFieldProps) {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={styles.input}
        onChange={(event) => {
          onChange(event.target.value)
        }}
      />
      {error && (
        <p id={errorId} className={styles.fieldError}>
          {error}
        </p>
      )}
    </div>
  )
}

export default FormField
