import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getActivity as getStudentActivity,
  listActivities as listStudentActivities,
  type ActivityDetail as StudentActivityDetail,
} from '../api/activitiesApi.ts'
import { me, type User } from '../api/authApi.ts'
import { getSession, listSessions } from '../api/historyApi.ts'
import { getActivity, listActivities, type ActivityDetail } from '../api/instructorActivitiesApi.ts'
import { AuthProvider } from '../auth/AuthProvider.tsx'
import { setToken } from '../auth/tokenStore.ts'
import { createPythonRunner } from '../features/runner/pythonRunner.ts'
import styles from './AppLayout.module.css'
import { routes } from './router.tsx'

vi.mock('../api/authApi.ts', () => ({
  register: vi.fn(),
  login: vi.fn(),
  me: vi.fn(),
}))

vi.mock('../api/activitiesApi.ts', () => ({
  listActivities: vi.fn(),
  getActivity: vi.fn(),
}))

vi.mock('../api/historyApi.ts', () => ({
  listSessions: vi.fn(),
  getSession: vi.fn(),
}))

vi.mock('../api/instructorActivitiesApi.ts', () => ({
  listActivities: vi.fn(),
  createActivity: vi.fn(),
  getActivity: vi.fn(),
  updateActivity: vi.fn(),
}))

// The workspace route mounts the Monaco editor, which needs a real browser and loads from a CDN.
vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-editor" />,
}))

// The workspace also warms up the Python runner, whose Web Worker jsdom does not have.
vi.mock('../features/runner/pythonRunner.ts', () => ({
  createPythonRunner: vi.fn(),
}))

const meMock = vi.mocked(me)
const listStudentActivitiesMock = vi.mocked(listStudentActivities)
const getStudentActivityMock = vi.mocked(getStudentActivity)
const createRunnerMock = vi.mocked(createPythonRunner)
const listSessionsMock = vi.mocked(listSessions)
const getSessionMock = vi.mocked(getSession)
const listActivitiesMock = vi.mocked(listActivities)
const getActivityMock = vi.mocked(getActivity)

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

const ACTIVITY: ActivityDetail = {
  id: 42,
  title: 'Sum two numbers',
  problemStatement: 'Read two integers and print their sum.',
  starterCode: '',
  status: 'DRAFT',
  testCases: [],
  createdAt: '2026-10-20T08:00:00Z',
  updatedAt: '2026-10-21T08:00:00Z',
}

const PUBLISHED_ACTIVITY: StudentActivityDetail = { ...ACTIVITY, title: 'Double a number', status: 'PUBLISHED' }

// Without a user there is no stored token, so AuthProvider starts anonymous and never calls the API.
function renderAt(path: string, user?: User) {
  // The student and instructor list/edit pages load on mount; mocked responses keep these routing tests offline.
  listStudentActivitiesMock.mockResolvedValue([])
  getStudentActivityMock.mockResolvedValue(PUBLISHED_ACTIVITY)
  createRunnerMock.mockReturnValue({ warmUp: vi.fn(async () => {}), run: vi.fn(), dispose: vi.fn() })
  listActivitiesMock.mockResolvedValue([])
  getActivityMock.mockResolvedValue(ACTIVITY)
  listSessionsMock.mockResolvedValue({ items: [], page: 0, size: 20, totalItems: 0 })
  getSessionMock.mockResolvedValue({
    sessionId: 7,
    activityId: 42,
    activityTitle: 'Loops',
    startedAt: '2026-11-03T02:15:00Z',
    endedAt: null,
    durationSeconds: null,
    runCount: 0,
    reflectionCount: 0,
    reflections: [],
  })
  if (user) {
    setToken(`token-${user.id}`, FUTURE)
    meMock.mockResolvedValue(user)
  }
  const router = createMemoryRouter(routes, { initialEntries: [path] })
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

describe('router', () => {
  it.each([
    ['/login', 'Log in'],
    ['/register', 'Create an account'],
    ['/nope', 'Page not found'],
    ['/student/nope/deeper', 'Page not found'],
  ])('renders %s for an anonymous user with the heading "%s"', (path, title) => {
    const router = renderAt(path)

    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(path)
  })

  it.each([
    ['/student/activities', 'Activities'],
    ['/student/activities/42', 'Double a number'],
    ['/student/history', 'My history'],
    ['/student/history/7', 'Loops'],
  ])('renders %s for a student with the heading "%s"', async (path, title) => {
    const router = renderAt(path, STUDENT)

    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(path)
  })

  it.each([
    ['/instructor/activities', 'My activities'],
    ['/instructor/activities/new', 'New activity'],
    ['/instructor/activities/42', 'Edit activity'],
  ])('renders %s for an instructor with the heading "%s"', async (path, title) => {
    const router = renderAt(path, INSTRUCTOR)

    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(path)
  })

  it.each([
    '/student/activities',
    '/student/activities/42',
    '/student/history',
    '/student/history/7',
    '/instructor/activities',
    '/instructor/activities/new',
    '/instructor/activities/42',
  ])('redirects an anonymous user from %s to /login', (path) => {
    const router = renderAt(path)

    expect(router.state.location.pathname).toBe('/login')
    expect(screen.getByRole('heading', { level: 1, name: 'Log in' })).toBeInTheDocument()
  })

  it.each(['/instructor/activities', '/instructor/activities/new', '/instructor/activities/42'])(
    'redirects a student from %s to /student/activities',
    async (path) => {
      const router = renderAt(path, STUDENT)

      expect(await screen.findByRole('heading', { level: 1, name: 'Activities' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/student/activities')
    },
  )

  it.each(['/student/activities', '/student/activities/42', '/student/history', '/student/history/7'])(
    'redirects an instructor from %s to /instructor/activities',
    async (path) => {
      const router = renderAt(path, INSTRUCTOR)

      expect(await screen.findByRole('heading', { level: 1, name: 'My activities' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/instructor/activities')
    },
  )

  it('redirects / to /login for an anonymous user', () => {
    const router = renderAt('/')

    expect(router.state.location.pathname).toBe('/login')
    expect(screen.getByRole('heading', { level: 1, name: 'Log in' })).toBeInTheDocument()
  })

  it.each([
    ['/student/activities', 'Activities', STUDENT],
    ['/instructor/activities', 'My activities', INSTRUCTOR],
  ])('redirects / to %s for a signed-in user', async (home, title, user) => {
    const router = renderAt('/', user)

    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(home)
  })

  it.each([
    ['/login', '/student/activities', 'Activities', STUDENT],
    ['/register', '/student/activities', 'Activities', STUDENT],
    ['/login', '/instructor/activities', 'My activities', INSTRUCTOR],
    ['/register', '/instructor/activities', 'My activities', INSTRUCTOR],
  ])('redirects a signed-in user from %s to %s', async (path, home, title, user) => {
    const router = renderAt(path, user)

    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(home)
    expect(router.state.historyAction).toBe('REPLACE')
  })

  it.each(['/', '/login', '/register', '/student/activities'])(
    'shows "Loading…" on %s while the stored token is checked',
    (path) => {
      setToken('token-7', FUTURE)
      meMock.mockReturnValue(new Promise<User>(() => {}))
      const router = renderAt(path)

      expect(screen.getByText('Loading…')).toBeInTheDocument()
      expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
      expect(router.state.location.pathname).toBe(path)
    },
  )

  it('keeps a student signed in after a refresh in the same tab', async () => {
    renderAt('/student/history', STUDENT)

    expect(await screen.findByRole('heading', { level: 1, name: 'My history' })).toBeInTheDocument()
    expect(meMock).toHaveBeenCalledExactlyOnceWith('token-7', expect.any(AbortSignal))
  })

  it('renders the student activity list at /student/activities', async () => {
    renderAt('/student/activities', STUDENT)

    expect(await screen.findByText('No activities are available yet. Check back later.')).toBeInTheDocument()
    expect(listStudentActivitiesMock).toHaveBeenCalledExactlyOnceWith('token-7', expect.any(AbortSignal))
  })

  it('renders the instructor activity list at /instructor/activities', async () => {
    renderAt('/instructor/activities', INSTRUCTOR)

    expect(await screen.findByText("You haven't created any activities yet.")).toBeInTheDocument()
    expect(listActivitiesMock).toHaveBeenCalledExactlyOnceWith('token-1', expect.any(AbortSignal))
  })

  it('renders the new activity form at /instructor/activities/new', async () => {
    renderAt('/instructor/activities/new', INSTRUCTOR)

    expect(await screen.findByRole('textbox', { name: 'Title' })).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
  })

  it('renders the activity edit page for the id in the URL', async () => {
    renderAt('/instructor/activities/42', INSTRUCTOR)

    expect(await screen.findByRole('textbox', { name: 'Title' })).toHaveValue('Sum two numbers')
    expect(getActivityMock).toHaveBeenCalledExactlyOnceWith('token-1', 42, expect.any(AbortSignal))
  })

  it('uses the full width for the activity workspace', async () => {
    renderAt('/student/activities/42', STUDENT)

    await screen.findByRole('heading', { level: 1, name: 'Double a number' })
    const main = screen.getByRole('main')
    expect(main).toHaveClass(styles.contentFull)
    expect(main).not.toHaveClass(styles.contentContained)
  })

  it('mounts the code editor on the activity workspace for the id in the URL', async () => {
    renderAt('/student/activities/42', STUDENT)

    expect(await screen.findByTestId('monaco-editor')).toBeInTheDocument()
    expect(getStudentActivityMock).toHaveBeenCalledExactlyOnceWith('token-7', 42, expect.any(AbortSignal))
  })

  it.each([
    ['/login', undefined],
    ['/nope', undefined],
    ['/student/activities', STUDENT],
    ['/instructor/activities/42', INSTRUCTOR],
  ])('limits the content width on %s', async (path, user) => {
    renderAt(path, user)

    await screen.findByRole('heading', { level: 1 })
    const main = screen.getByRole('main')
    expect(main).toHaveClass(styles.contentContained)
    expect(main).not.toHaveClass(styles.contentFull)
  })
})
