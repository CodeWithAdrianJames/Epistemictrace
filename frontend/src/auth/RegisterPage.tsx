import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError } from '../api/ApiError.ts'
import Icon from '../components/Icon.tsx'
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
import HeroIllustration from './HeroIllustration.tsx'
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

  // ui-context.md → Auth Pages: the sign-up hero from ui/main screens/epistemictrace-signup.png.
  return (
    <div className={styles.hero}>
      <section className={styles.heroMain}>
        <p className={styles.tagline}>
          <span className={styles.taglineLead}>Learn Python</span>
          <span className={styles.taglineRest}>one struggle at a time</span>
        </p>
        <p className={styles.lede}>
          Write real Python in your browser, reflect on where you got stuck, and turn every struggle into steady
          progress.
        </p>
        <div className={styles.heroForm}>
          <h1 className={styles.formHeading}>Create an account</h1>
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
              placeholder="Your name"
              value={values.name}
              error={fieldErrors.name}
              onChange={setField('name')}
            />
            <FormField
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="Your email"
              value={values.email}
              error={fieldErrors.email}
              onChange={setField('email')}
            />
            <FormField
              label="Password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="Your password"
              value={values.password}
              error={fieldErrors.password}
              onChange={setField('password')}
            />
            <FormField
              label="Confirm password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Type it again"
              value={values.confirmPassword}
              error={fieldErrors.confirmPassword}
              onChange={setField('confirmPassword')}
            />
            <button type="submit" className={`${styles.submit} ${styles.submitCompact}`} disabled={submitting}>
              Create account
            </button>
          </form>
          <p className={`${styles.switch} ${styles.switchStart}`}>
            Already have an account?{' '}
            <Link to="/login" className={styles.switchLink}>
              Log in
            </Link>
          </p>
        </div>
      </section>
      <div className={styles.heroArt}>
        <HeroIllustration />
      </div>
      <div className={styles.factsRow}>
        <p className={styles.motto}>
          <span className={styles.mottoIcons} aria-hidden="true">
            <Icon name="code" />
            <Icon name="chart" />
            <Icon name="star" />
          </span>
          Code. Reflect. Grow.
        </p>
        <dl className={styles.facts}>
          <div className={styles.fact}>
            <dt>Language</dt>
            <dd>Python 3</dd>
          </div>
          <div className={styles.fact}>
            <dt>Practice</dt>
            <dd>Real problems</dd>
          </div>
          <div className={styles.fact}>
            <dt>Insights</dt>
            <dd>Struggle tracking</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

export default RegisterPage
