import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/ApiError.ts'
import { me, type User } from '../api/authApi.ts'
import { AuthProvider } from '../auth/AuthProvider.tsx'
import { setToken } from '../auth/tokenStore.ts'
import RequireRole from './RequireRole.tsx'

vi.mock('../api/authApi.ts', () => ({
  register: vi.fn(),
  login: vi.fn(),
  me: vi.fn(),
}))

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

function signInAs(user: User) {
  setToken(`token-${user.id}`, FUTURE)
  meMock.mockResolvedValue(user)
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <h1>Login stub</h1> },
      {
        path: '/student/activities',
        element: (
          <RequireRole role="STUDENT">
            <h1>Student page</h1>
          </RequireRole>
        ),
      },
      {
        path: '/instructor/activities',
        element: (
          <RequireRole role="INSTRUCTOR">
            <h1>Instructor page</h1>
          </RequireRole>
        ),
      },
    ],
    { initialEntries: [path] },
  )
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
  return router
}

afterEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
})

describe('RequireRole', () => {
  it('redirects an anonymous user to /login', () => {
    const router = renderAt('/student/activities')

    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.historyAction).toBe('REPLACE')
    expect(screen.getByRole('heading', { level: 1, name: 'Login stub' })).toBeInTheDocument()
    expect(screen.queryByText('Student page')).not.toBeInTheDocument()
  })

  it('redirects to /login when the stored token is rejected with 401', async () => {
    setToken('stale-token', FUTURE)
    meMock.mockRejectedValue(new ApiError({ status: 401, title: 'Unauthorized', detail: 'x', fieldErrors: {} }))
    const router = renderAt('/student/activities')

    expect(await screen.findByRole('heading', { level: 1, name: 'Login stub' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('shows "Loading…" while the stored token is checked', () => {
    setToken('token-7', FUTURE)
    meMock.mockReturnValue(new Promise<User>(() => {}))
    const router = renderAt('/student/activities')

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByText('Student page')).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/student/activities')
  })

  it('redirects a student on an instructor page to the student home', async () => {
    signInAs(STUDENT)
    const router = renderAt('/instructor/activities')

    expect(await screen.findByRole('heading', { level: 1, name: 'Student page' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/student/activities')
    expect(screen.queryByText('Instructor page')).not.toBeInTheDocument()
  })

  it('redirects an instructor on a student page to the instructor home', async () => {
    signInAs(INSTRUCTOR)
    const router = renderAt('/student/activities')

    expect(await screen.findByRole('heading', { level: 1, name: 'Instructor page' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/instructor/activities')
  })

  it.each([
    ['/student/activities', 'Student page', STUDENT],
    ['/instructor/activities', 'Instructor page', INSTRUCTOR],
  ])('renders the children of %s for the right role', async (path, heading, user) => {
    signInAs(user)
    const router = renderAt(path)

    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(path)
  })
})
