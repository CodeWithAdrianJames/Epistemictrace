import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { listActivities as listStudentActivities } from '../api/activitiesApi.ts'
import { me, type User } from '../api/authApi.ts'
import { listActivities } from '../api/instructorActivitiesApi.ts'
import { AuthProvider } from '../auth/AuthProvider.tsx'
import { getToken, setToken } from '../auth/tokenStore.ts'
import { routes } from './router.tsx'

vi.mock('../api/authApi.ts', () => ({
  register: vi.fn(),
  login: vi.fn(),
  me: vi.fn(),
}))

vi.mock('../api/activitiesApi.ts', () => ({
  listActivities: vi.fn(),
}))

vi.mock('../api/instructorActivitiesApi.ts', () => ({
  listActivities: vi.fn(),
}))

const meMock = vi.mocked(me)
const listStudentActivitiesMock = vi.mocked(listStudentActivities)
const listActivitiesMock = vi.mocked(listActivities)

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

function renderAt(entries: string[], user?: User) {
  // The student and instructor list pages load on mount; empty lists keep these tests offline.
  listStudentActivitiesMock.mockResolvedValue([])
  listActivitiesMock.mockResolvedValue([])
  if (user) {
    setToken(`token-${user.id}`, FUTURE)
    meMock.mockResolvedValue(user)
  }
  const router = createMemoryRouter(routes, { initialEntries: entries })
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

describe('TopBar', () => {
  it('shows only the product name to an anonymous user', () => {
    renderAt(['/login'])

    const header = screen.getByRole('banner')
    expect(within(header).getByRole('link', { name: 'EpistemicTrace' })).toHaveAttribute('href', '/')
    expect(within(header).getAllByRole('link')).toHaveLength(1)
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
  })

  it('hides the links and Log out while the stored token is checked', () => {
    setToken('token-7', FUTURE)
    meMock.mockReturnValue(new Promise<User>(() => {}))
    renderAt(['/student/activities'])

    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
  })

  it('shows the student links, the user name and Log out to a student', async () => {
    renderAt(['/student/activities'], STUDENT)

    const nav = await screen.findByRole('navigation', { name: 'Main' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(['Activities', 'History'])
    expect(within(nav).getByRole('link', { name: 'Activities' })).toHaveAttribute('href', '/student/activities')
    expect(within(nav).getByRole('link', { name: 'History' })).toHaveAttribute('href', '/student/history')
    expect(within(screen.getByRole('banner')).getByText('Student One')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()
  })

  it('shows the instructor link, the user name and Log out to an instructor', async () => {
    renderAt(['/instructor/activities'], INSTRUCTOR)

    const nav = await screen.findByRole('navigation', { name: 'Main' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(['My activities'])
    expect(links[0]).toHaveAttribute('href', '/instructor/activities')
    expect(within(screen.getByRole('banner')).getByText('Instructor One')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()
  })

  it('marks the link for the current section as the current page', async () => {
    renderAt(['/student/history/7'], STUDENT)

    const nav = await screen.findByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'History' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Activities' })).not.toHaveAttribute('aria-current')
  })

  it.each([STUDENT, INSTRUCTOR])('logs $role out to /login and clears the token', async (user) => {
    const router = renderAt([user.role === 'STUDENT' ? '/student/history' : '/instructor/activities/42'], user)

    fireEvent.click(await screen.findByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Log in' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(getToken()).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
  })

  it('does not show a protected page when Back is pressed after Log out', async () => {
    const router = renderAt(['/student/activities', '/student/history'], STUDENT)

    fireEvent.click(await screen.findByRole('button', { name: 'Log out' }))
    await screen.findByRole('heading', { level: 1, name: 'Log in' })
    expect(router.state.historyAction).toBe('REPLACE')

    await act(async () => {
      await router.navigate(-1)
    })

    expect(router.state.location.pathname).toBe('/login')
    expect(screen.getByRole('heading', { level: 1, name: 'Log in' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1, name: 'Activities' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1, name: 'My history' })).not.toBeInTheDocument()
  })
})
