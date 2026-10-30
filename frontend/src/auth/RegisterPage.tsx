import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError } from '../api/ApiError.ts'
import { useAuth } from './AuthProvider.tsx'
import styles from './AuthForm.module.css'
import {
  formErrorsFrom,
  hasErrors,
  REGISTER_SERVER_FIELDS,
  validateRegister,
  type FieldErrors,
  type RegisterField,
  type RegisterValues,
} from './authForms.ts'
import FormField from './FormField.tsx'
import { homePathFor } from './homePath.ts'

const EMPTY: RegisterValues = { name: '', email: '', password: '', confirmPassword: '' }

function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [values, setValues] = useState<RegisterValues>(EMPTY)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<RegisterField>>({})
  const [pageError, setPageError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const setField = (field: RegisterField) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
  }

  async function submit(name: string, email: string, password: string) {
    setSubmitting(true)
    try {
      // AuthProvider.register logs in with the same credentials after the 201 (R6).
      const user = await register(name, email, password)
      navigate(homePathFor(user.role), { replace: true })
    } catch (error: unknown) {
      setSubmitting(false)
      if (error instanceof ApiError && error.status === 409) {
        setFieldErrors({ email: error.detail })
        return
      }
      const mapped = formErrorsFrom(error, REGISTER_SERVER_FIELDS)
      setFieldErrors(mapped.fieldErrors)
      setPageError(mapped.formError)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) {
      return
    }
    const errors = validateRegister(values)
    setFieldErrors(errors)
    setPageError(null)
    if (hasErrors(errors)) {
      return
    }
    void submit(values.name.trim(), values.email.trim(), values.password)
  }

  return (
    <div className={styles.page}>
      <section className={styles.panel}>
        <h1 className={styles.heading}>Create an account</h1>
        {pageError && (
          <p role="alert" className={styles.pageError}>
            {pageError}
          </p>
        )}
        <form className={styles.form} noValidate onSubmit={handleSubmit}>
          <FormField
            label="Name"
            name="name"
            type="text"
            autoComplete="name"
            value={values.name}
            error={fieldErrors.name}
            onChange={setField('name')}
          />
          <FormField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            error={fieldErrors.email}
            onChange={setField('email')}
          />
          <FormField
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={values.password}
            error={fieldErrors.password}
            onChange={setField('password')}
          />
          <FormField
            label="Confirm password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={values.confirmPassword}
            error={fieldErrors.confirmPassword}
            onChange={setField('confirmPassword')}
          />
          <button type="submit" className={styles.submit} disabled={submitting}>
            Create account
          </button>
        </form>
        <p className={styles.switch}>
          Already have an account?{' '}
          <Link to="/login" className={styles.switchLink}>
            Log in
          </Link>
        </p>
      </section>
    </div>
  )
}

export default RegisterPage
