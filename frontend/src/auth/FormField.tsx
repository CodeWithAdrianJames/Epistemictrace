import { useId, useState } from 'react'
import Icon from '../components/Icon.tsx'
import styles from './AuthForm.module.css'

interface FormFieldProps {
  label: string
  name: string
  type: 'text' | 'email' | 'password'
  autoComplete: string
  value: string
  placeholder?: string
  error?: string
  onChange: (value: string) => void
}

// One labelled input with its error underneath, linked through aria-describedby. Password fields get
// the eye toggle from the UI reference; it only switches what the input shows.
function FormField({ label, name, type, autoComplete, value, placeholder, error, onChange }: FormFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.control}>
        <input
          id={id}
          name={name}
          type={isPassword && revealed ? 'text' : type}
          autoComplete={autoComplete}
          value={value}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={isPassword ? `${styles.input} ${styles.inputWithToggle}` : styles.input}
          onChange={(event) => {
            onChange(event.target.value)
          }}
        />
        {isPassword && (
          <button
            type="button"
            className={styles.reveal}
            aria-label={revealed ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            aria-pressed={revealed}
            onClick={() => setRevealed((current) => !current)}
          >
            <Icon name={revealed ? 'eye' : 'eyeOff'} />
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} className={styles.fieldError}>
          {error}
        </p>
      )}
    </div>
  )
}

export default FormField
