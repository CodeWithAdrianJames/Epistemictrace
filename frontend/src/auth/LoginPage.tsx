import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError } from '../api/ApiError.ts'
import { useAuth } from './AuthProvider.tsx'
import styles from './AuthForm.module.css'
import {
  formErrorsFrom,
  hasErrors,
  LOGIN_FIELDS,
  validateLogin,
  type FieldErrors,
  type LoginField,
  type LoginValues,
} from './authForms.ts'
import FormField from './FormField.tsx'
import { homePathFor } from './homePath.ts'

// Spec 07 R5: shown under the form on 401, whatever detail the server sends.
const INVALID_CREDENTIALS = 'Email or password is incorrect.'

function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [values, setValues] = useState<LoginValues>({ email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<LoginField>>({})
  const [credentialsError, setCredentialsError] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const setField = (field: LoginField) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
  }

  async function submit(email: string, password: string) {
    setSubmitting(true)
    try {
      const user = await login(email, password)
      navigate(homePathFor(user.role), { replace: true })
    } catch (error: unknown) {
      setSubmitting(false)
      if (error instanceof ApiError && error.status === 401) {
        setCredentialsError(INVALID_CREDENTIALS)
        return
      }
      const mapped = formErrorsFrom(error, LOGIN_FIELDS)
      setFieldErrors(mapped.fieldErrors)
      setPageError(mapped.formError)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) {
      return
    }
    const errors = validateLogin(values)
    setFieldErrors(errors)
    setCredentialsError(null)
    setPageError(null)
    if (hasErrors(errors)) {
      return
    }
    void submit(values.email.trim(), values.password)
  }

  return (
    <div className={styles.page}>
      <section className={styles.panel}>
        <h1 className={styles.heading}>Log in</h1>
        {pageError && (
          <p role="alert" className={styles.pageError}>
            {pageError}
          </p>
        )}
        <form className={styles.form} noValidate onSubmit={handleSubmit}>
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
            autoComplete="current-password"
            value={values.password}
            error={fieldErrors.password}
            onChange={setField('password')}
          />
          <button type="submit" className={styles.submit} disabled={submitting}>
            Log in
          </button>
          {credentialsError && (
            <p role="alert" className={styles.formError}>
              {credentialsError}
            </p>
          )}
        </form>
        <p className={styles.switch}>
          New here?{' '}
          <Link to="/register" className={styles.switchLink}>
            Create an account
          </Link>
        </p>
      </section>
    </div>
  )
}

export default LoginPage
