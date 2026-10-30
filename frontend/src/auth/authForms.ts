import { ApiError } from '../api/ApiError.ts'

export interface LoginValues {
  email: string
  password: string
}

export interface RegisterValues {
  name: string
  email: string
  password: string
  confirmPassword: string
}

export type LoginField = keyof LoginValues
export type RegisterField = keyof RegisterValues
export type FieldErrors<F extends string> = Partial<Record<F, string>>

export interface FormErrors<F extends string> {
  fieldErrors: FieldErrors<F>
  formError: string | null
}

export const LOGIN_FIELDS: readonly LoginField[] = ['email', 'password']
// confirmPassword is never sent, so the server cannot report an error for it.
export const REGISTER_SERVER_FIELDS: readonly RegisterField[] = ['name', 'email', 'password']

// Spec 05 R1 limits, mirrored so most mistakes are caught before a request.
const NAME_MAX = 100
const EMAIL_MAX = 254
const PASSWORD_MIN = 8
const PASSWORD_MAX = 72

const FALLBACK_DETAIL = 'Something went wrong. Please try again.'
const utf8 = new TextEncoder()

export function validateLogin(values: LoginValues): FieldErrors<LoginField> {
  const errors: FieldErrors<LoginField> = {}
  if (values.email.trim() === '') {
    errors.email = 'Enter your email.'
  }
  if (values.password === '') {
    errors.password = 'Enter your password.'
  }
  return errors
}

export function validateRegister(values: RegisterValues): FieldErrors<RegisterField> {
  const errors: FieldErrors<RegisterField> = {}

  const name = values.name.trim()
  if (name === '') {
    errors.name = 'Enter your name.'
  } else if (name.length > NAME_MAX) {
    errors.name = `Name must be ${NAME_MAX} characters or fewer.`
  }

  const email = values.email.trim()
  if (email === '') {
    errors.email = 'Enter your email.'
  } else if (email.length > EMAIL_MAX) {
    errors.email = `Email must be ${EMAIL_MAX} characters or fewer.`
  } else if (!isEmailShaped(email)) {
    errors.email = 'Enter a valid email address.'
  }

  // String length counts UTF-16 code units, the same unit as the server's @Size; BCrypt also caps UTF-8 bytes.
  const { password } = values
  if (password.length < PASSWORD_MIN) {
    errors.password = `Password must be at least ${PASSWORD_MIN} characters.`
  } else if (password.length > PASSWORD_MAX || utf8.encode(password).length > PASSWORD_MAX) {
    errors.password = `Password must be ${PASSWORD_MAX} characters or fewer (accented letters and emoji count as more than one).`
  }

  if (values.confirmPassword !== password) {
    errors.confirmPassword = 'Passwords do not match.'
  }

  return errors
}

export function hasErrors<F extends string>(errors: FieldErrors<F>): boolean {
  return Object.keys(errors).length > 0
}

// Maps a failed request onto the form: server field errors go under their fields, anything else is one message.
export function formErrorsFrom<F extends string>(error: unknown, fields: readonly F[]): FormErrors<F> {
  if (!(error instanceof ApiError)) {
    return { fieldErrors: {}, formError: FALLBACK_DETAIL }
  }
  const fieldErrors: FieldErrors<F> = {}
  for (const field of fields) {
    const message = error.fieldErrors[field]
    if (message !== undefined) {
      fieldErrors[field] = message
    }
  }
  return { fieldErrors, formError: hasErrors(fieldErrors) ? null : error.detail }
}

// Deliberately loose (one @, no spaces): the server's @Email check is the authority and its error maps back.
function isEmailShaped(email: string): boolean {
  return /^[^\s@]+@[^\s@]+$/.test(email)
}
