import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/ApiError.ts'
import { formErrorsFrom, hasErrors, LOGIN_FIELDS, validateLogin, validateRegister, type RegisterValues } from './authForms.ts'

const VALID: RegisterValues = {
  name: 'Student One',
  email: 'student1@example.test',
  password: 'correct-horse',
  confirmPassword: 'correct-horse',
}

function withPassword(password: string): RegisterValues {
  return { ...VALID, password, confirmPassword: password }
}

describe('validateLogin', () => {
  it('accepts any non-blank email and non-empty password', () => {
    expect(validateLogin({ email: 'student1@example.test', password: 'x' })).toEqual({})
  })

  it('asks for a blank email and an empty password', () => {
    expect(validateLogin({ email: ' \t ', password: '' })).toEqual({
      email: 'Enter your email.',
      password: 'Enter your password.',
    })
  })
})

describe('validateRegister', () => {
  it('accepts valid values', () => {
    expect(validateRegister(VALID)).toEqual({})
  })

  it('checks the trimmed name is 1 to 100 characters', () => {
    expect(validateRegister({ ...VALID, name: '   ' }).name).toBe('Enter your name.')
    expect(validateRegister({ ...VALID, name: ` ${'a'.repeat(100)} ` }).name).toBeUndefined()
    expect(validateRegister({ ...VALID, name: 'a'.repeat(101) }).name).toBe('Name must be 100 characters or fewer.')
  })

  it('checks the trimmed email is present, at most 254 characters and email-shaped', () => {
    const at254 = `${'a'.repeat(241)}@example.test`
    expect(at254).toHaveLength(254)

    expect(validateRegister({ ...VALID, email: '' }).email).toBe('Enter your email.')
    expect(validateRegister({ ...VALID, email: ` ${at254} ` }).email).toBeUndefined()
    expect(validateRegister({ ...VALID, email: `a${at254}` }).email).toBe('Email must be 254 characters or fewer.')
    for (const email of ['student1', 'student1@', '@example.test', 'a@b@c', 'stu dent@example.test']) {
      expect(validateRegister({ ...VALID, email }).email).toBe('Enter a valid email address.')
    }
  })

  it('checks the password is 8 to 72 characters', () => {
    expect(validateRegister(withPassword('a'.repeat(7))).password).toBe('Password must be at least 8 characters.')
    expect(validateRegister(withPassword('a'.repeat(8))).password).toBeUndefined()
    expect(validateRegister(withPassword('a'.repeat(72))).password).toBeUndefined()
    expect(validateRegister(withPassword('a'.repeat(73))).password).toMatch(/^Password must be 72 characters or fewer/)
  })

  it('rejects a password over 72 UTF-8 bytes even when it is 72 characters or fewer', () => {
    const accented = 'é'.repeat(37)
    expect(accented).toHaveLength(37)

    expect(validateRegister(withPassword('é'.repeat(36))).password).toBeUndefined()
    expect(validateRegister(withPassword(accented)).password).toMatch(/^Password must be 72 characters or fewer/)
  })

  it('does not trim the password', () => {
    expect(validateRegister(withPassword(' a b c  ')).password).toBeUndefined()
  })

  it('requires the confirmation to match exactly', () => {
    expect(validateRegister({ ...VALID, confirmPassword: '' }).confirmPassword).toBe('Passwords do not match.')
    expect(validateRegister({ ...VALID, confirmPassword: `${VALID.password} ` }).confirmPassword).toBe(
      'Passwords do not match.',
    )
  })
})

describe('hasErrors', () => {
  it('is true only when a field has a message', () => {
    expect(hasErrors({})).toBe(false)
    expect(hasErrors({ email: 'Enter your email.' })).toBe(true)
  })
})

describe('formErrorsFrom', () => {
  it('keeps field errors for the form fields and drops the rest', () => {
    const error = new ApiError({
      status: 400,
      title: 'Bad Request',
      detail: 'Invalid request content.',
      fieldErrors: { email: 'must not be blank', role: 'unknown' },
    })

    expect(formErrorsFrom(error, LOGIN_FIELDS)).toEqual({ fieldErrors: { email: 'must not be blank' }, formError: null })
  })

  it('falls back to the detail when no field error belongs to the form', () => {
    const error = new ApiError({ status: 400, title: 'Bad Request', detail: 'Invalid request content.', fieldErrors: { role: 'x' } })

    expect(formErrorsFrom(error, LOGIN_FIELDS)).toEqual({ fieldErrors: {}, formError: 'Invalid request content.' })
  })

  it('uses a generic message for anything that is not an ApiError', () => {
    expect(formErrorsFrom(new TypeError('boom'), LOGIN_FIELDS)).toEqual({
      fieldErrors: {},
      formError: 'Something went wrong. Please try again.',
    })
  })
})
