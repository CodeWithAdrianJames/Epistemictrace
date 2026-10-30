import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/ApiError.ts'
import { login, register, type LoginResult, type RegisteredUser, type User } from '../api/authApi.ts'
import { AuthProvider } from './AuthProvider.tsx'
import RegisterPage from './RegisterPage.tsx'
import { getToken } from './tokenStore.ts'

vi.mock('../api/authApi.ts', () => ({
  register: vi.fn(),
  login: vi.fn(),
  me: vi.fn(),
}))

const registerMock = vi.mocked(register)
const loginMock = vi.mocked(login)

const STUDENT: User = {
  id: 7,
  name: 'Student One',
  email: 'student1@example.test',
  role: 'STUDENT',
  consentAccepted: false,
}

const REGISTERED: RegisteredUser = { id: 7, name: 'Student One', email: 'student1@example.test', role: 'STUDENT' }
const LOGGED_IN: LoginResult = { token: 'token-7', expiresAt: '2099-01-01T00:00:00Z', user: STUDENT }

interface FormInput {
  name: string
  email: string
  password: string
  confirmPassword: string
}

const VALID: FormInput = {
  name: 'Student One',
  email: 'student1@example.test',
  password: 'correct-horse',
  confirmPassword: 'correct-horse',
}

function apiError(status: number, detail: string, fieldErrors: Record<string, string> = {}): ApiError {
  return new ApiError({ status, title: `HTTP ${status}`, detail, fieldErrors })
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function renderRegister() {
  const router = createMemoryRouter(
    [
      { path: '/register', element: <RegisterPage /> },
      { path: '/login', element: <h1>Login stub</h1> },
      { path: '/student/activities', element: <h1>Student home</h1> },
    ],
    { initialEntries: ['/register'] },
  )
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
  return router
}

function fillAndSubmit(input: FormInput) {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: input.name } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: input.email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: input.password } })
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: input.confirmPassword } })
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
}

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
})

describe('RegisterPage', () => {
  it('shows the four fields, the submit button and a link to log in', () => {
    renderRegister()

    expect(screen.getByRole('heading', { level: 1, name: 'Create an account' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login')
  })

  it('registers, logs in with the same credentials and lands on /student/activities', async () => {
    registerMock.mockResolvedValue(REGISTERED)
    loginMock.mockResolvedValue(LOGGED_IN)
    const router = renderRegister()

    fillAndSubmit({ ...VALID, name: '  Student One ', email: ' student1@example.test ' })

    expect(await screen.findByRole('heading', { level: 1, name: 'Student home' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/student/activities')
    expect(router.state.historyAction).toBe('REPLACE')
    expect(registerMock).toHaveBeenCalledExactlyOnceWith('Student One', 'student1@example.test', 'correct-horse')
    expect(loginMock).toHaveBeenCalledExactlyOnceWith('student1@example.test', 'correct-horse')
    expect(getToken()).toBe('token-7')
  })

  it('shows the server message under the email field on 409 and stays on /register', async () => {
    registerMock.mockRejectedValue(apiError(409, 'An account with this email already exists.'))
    const router = renderRegister()

    fillAndSubmit(VALID)

    await waitFor(() => {
      expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('An account with this email already exists.')
    })
    expect(router.state.location.pathname).toBe('/register')
    expect(loginMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled()
  })

  it('maps server field errors to their fields', async () => {
    registerMock.mockRejectedValue(
      apiError(400, 'Invalid request content.', {
        name: 'size must be between 0 and 100',
        password: 'must be at most 72 bytes when UTF-8 encoded',
      }),
    )
    renderRegister()

    fillAndSubmit(VALID)

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('size must be between 0 and 100')
    })
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('must be at most 72 bytes when UTF-8 encoded')
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows other API errors at the top of the page', async () => {
    registerMock.mockRejectedValue(apiError(500, 'Something went wrong. Please try again.'))
    renderRegister()

    fillAndSubmit(VALID)

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
    expect(loginMock).not.toHaveBeenCalled()
  })

  it('blocks the request and shows each client check under its field', () => {
    renderRegister()

    fillAndSubmit({ name: '   ', email: 'not-an-email', password: 'short', confirmPassword: 'different' })

    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Enter your name.')
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter a valid email address.')
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Password must be at least 8 characters.')
    expect(screen.getByLabelText('Confirm password')).toHaveAccessibleDescription('Passwords do not match.')
    expect(registerMock).not.toHaveBeenCalled()
  })

  it('disables the button while submitting and ignores a second submit', async () => {
    const pending = deferred<RegisteredUser>()
    registerMock.mockReturnValue(pending.promise)
    loginMock.mockResolvedValue(LOGGED_IN)
    renderRegister()

    fillAndSubmit(VALID)

    const button = screen.getByRole('button', { name: 'Create account' })
    expect(button).toBeDisabled()
    fireEvent.submit(button.closest('form') as HTMLFormElement)
    expect(registerMock).toHaveBeenCalledTimes(1)

    pending.resolve(REGISTERED)
    expect(await screen.findByRole('heading', { level: 1, name: 'Student home' })).toBeInTheDocument()
  })
})
