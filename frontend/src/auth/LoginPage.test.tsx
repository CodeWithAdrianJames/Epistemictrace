import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/ApiError.ts'
import { login, me, type LoginResult, type User } from '../api/authApi.ts'
import { AuthProvider } from './AuthProvider.tsx'
import LoginPage from './LoginPage.tsx'
import { getToken } from './tokenStore.ts'

vi.mock('../api/authApi.ts', () => ({
  register: vi.fn(),
  login: vi.fn(),
  me: vi.fn(),
}))

const loginMock = vi.mocked(login)
const meMock = vi.mocked(me)

const FUTURE = '2099-01-01T00:00:00Z'

const STUDENT: User = {
  id: 7,
  name: 'Student One',
  email: 'student1@example.test',
  role: 'STUDENT',
  consentAccepted: false,
}

const INSTRUCTOR: User = {
  id: 1,
  name: 'Instructor One',
  email: 'instructor1@example.test',
  role: 'INSTRUCTOR',
  consentAccepted: false,
}

function loginResult(user: User): LoginResult {
  return { token: `token-${user.id}`, expiresAt: FUTURE, user }
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

function renderLogin() {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <h1>Register stub</h1> },
      { path: '/student/activities', element: <h1>Student home</h1> },
      { path: '/instructor/activities', element: <h1>Instructor home</h1> },
    ],
    { initialEntries: ['/login'] },
  )
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
  return router
}

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
}

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
})

describe('LoginPage', () => {
  it('shows email and password fields, the Log in button and a link to register', () => {
    renderLogin()

    expect(screen.getByRole('heading', { level: 1, name: 'Log in' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled()
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register')
    expect(meMock).not.toHaveBeenCalled()
  })

  it('shows the error message under the form on 401 and stays on /login', async () => {
    loginMock.mockRejectedValue(apiError(401, 'Email or password is incorrect.'))
    const router = renderLogin()

    fillAndSubmit('student1@example.test', 'wrong-password')

    expect(await screen.findByText('Email or password is incorrect.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled()
    expect(getToken()).toBeNull()
    const form = screen.getByRole('button', { name: 'Log in' }).closest('form')
    expect(form?.lastElementChild).toHaveTextContent('Email or password is incorrect.')
  })

  it('shows the fixed 401 message even when the server detail differs', async () => {
    loginMock.mockRejectedValue(apiError(401, 'Bad credentials'))
    renderLogin()

    fillAndSubmit('student1@example.test', 'wrong-password')

    expect(await screen.findByText('Email or password is incorrect.')).toBeInTheDocument()
    expect(screen.queryByText('Bad credentials')).not.toBeInTheDocument()
  })

  it.each([
    ['/student/activities', 'Student home', STUDENT],
    ['/instructor/activities', 'Instructor home', INSTRUCTOR],
  ])('redirects to %s by role on success', async (path, heading, user) => {
    loginMock.mockResolvedValue(loginResult(user))
    const router = renderLogin()

    fillAndSubmit(user.email, 'correct-password')

    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(path)
    expect(loginMock).toHaveBeenCalledExactlyOnceWith(user.email, 'correct-password')
    expect(getToken()).toBe(`token-${user.id}`)
  })

  it('replaces /login in the history so Back does not return to the form', async () => {
    loginMock.mockResolvedValue(loginResult(STUDENT))
    const router = renderLogin()

    fillAndSubmit(STUDENT.email, 'correct-password')

    await screen.findByRole('heading', { level: 1, name: 'Student home' })
    expect(router.state.historyAction).toBe('REPLACE')
  })

  it('trims the email but sends the password unchanged', async () => {
    loginMock.mockResolvedValue(loginResult(STUDENT))
    renderLogin()

    fillAndSubmit('  student1@example.test  ', ' pass word ')

    await screen.findByRole('heading', { level: 1, name: 'Student home' })
    expect(loginMock).toHaveBeenCalledExactlyOnceWith('student1@example.test', ' pass word ')
  })

  it('disables the button while submitting and ignores a second submit', async () => {
    const pending = deferred<LoginResult>()
    loginMock.mockReturnValue(pending.promise)
    renderLogin()

    fillAndSubmit(STUDENT.email, 'correct-password')

    const button = screen.getByRole('button', { name: 'Log in' })
    expect(button).toBeDisabled()
    fireEvent.submit(button.closest('form') as HTMLFormElement)
    expect(loginMock).toHaveBeenCalledTimes(1)

    pending.resolve(loginResult(STUDENT))
    expect(await screen.findByRole('heading', { level: 1, name: 'Student home' })).toBeInTheDocument()
  })

  it('asks for missing fields without calling the API', () => {
    renderLogin()

    fillAndSubmit('   ', '')

    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter your email.')
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Enter your password.')
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(loginMock).not.toHaveBeenCalled()
  })

  it('clears a previous 401 message on the next submit', async () => {
    loginMock.mockRejectedValueOnce(apiError(401, 'Email or password is incorrect.'))
    const pending = deferred<LoginResult>()
    loginMock.mockReturnValueOnce(pending.promise)
    renderLogin()

    fillAndSubmit(STUDENT.email, 'wrong-password')
    await screen.findByText('Email or password is incorrect.')
    fillAndSubmit(STUDENT.email, 'correct-password')

    expect(screen.queryByText('Email or password is incorrect.')).not.toBeInTheDocument()
    pending.resolve(loginResult(STUDENT))
    await screen.findByRole('heading', { level: 1, name: 'Student home' })
  })

  it('shows other API errors at the top of the page with the server detail', async () => {
    loginMock.mockRejectedValue(apiError(0, "Can't reach the server. Check your connection."))
    const router = renderLogin()

    fillAndSubmit(STUDENT.email, 'correct-password')

    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server. Check your connection.")
    expect(screen.queryByText('Email or password is incorrect.')).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled()
  })

  it('maps server field errors to their fields', async () => {
    loginMock.mockRejectedValue(apiError(400, 'Invalid request content.', { email: 'must not be blank' }))
    renderLogin()

    fillAndSubmit(STUDENT.email, 'correct-password')

    await waitFor(() => {
      expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('must not be blank')
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
