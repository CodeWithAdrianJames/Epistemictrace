import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/ApiError.ts'
import { listActivities, type ActivitySummary } from '../../api/activitiesApi.ts'
import { me, type User } from '../../api/authApi.ts'
import RequireRole from '../../app/RequireRole.tsx'
import { AuthProvider } from '../../auth/AuthProvider.tsx'
import { getToken, setToken } from '../../auth/tokenStore.ts'
import StudentActivityListPage from './StudentActivityListPage.tsx'

vi.mock('../../api/authApi.ts', () => ({
  register: vi.fn(),
  login: vi.fn(),
  me: vi.fn(),
}))

vi.mock('../../api/activitiesApi.ts', () => ({
  listActivities: vi.fn(),
}))

const meMock = vi.mocked(me)
const listActivitiesMock = vi.mocked(listActivities)

const FUTURE = '2099-01-01T00:00:00Z'
const TOKEN = 'token-1'

const STUDENT: User = {
  id: 1,
  name: 'Student One',
  email: 'student1@example.test',
  role: 'STUDENT',
  consentAccepted: false,
}

const FIZZBUZZ: ActivitySummary = {
  id: 2,
  title: 'FizzBuzz',
  status: 'PUBLISHED',
  testCaseCount: 1,
  updatedAt: '2026-10-11T08:00:00Z',
}

const SUM: ActivitySummary = {
  id: 3,
  title: 'Sum two numbers',
  status: 'PUBLISHED',
  testCaseCount: 2,
  updatedAt: '2026-10-21T08:01:00Z',
}

function apiError(status: number, detail: string): ApiError {
  return new ApiError({ status, title: `HTTP ${status}`, detail, fieldErrors: {} })
}

// The page sits behind RequireRole in the app router, so it only mounts once the stored token is confirmed.
function renderPage() {
  setToken(TOKEN, FUTURE)
  meMock.mockResolvedValue(STUDENT)
  const router = createMemoryRouter(
    [
      {
        path: '/student/activities',
        element: (
          <RequireRole role="STUDENT">
            <StudentActivityListPage />
          </RequireRole>
        ),
      },
      { path: '/student/activities/:activityId', element: <h1>Workspace page</h1> },
      { path: '/login', element: <h1>Log in page</h1> },
    ],
    { initialEntries: ['/student/activities'] },
  )
  const view = render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
  return { router, ...view }
}

async function findRows(): Promise<HTMLElement[]> {
  const list = await screen.findByRole('list', { name: 'Activities' })
  return within(list).getAllByRole('listitem')
}

afterEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
})

describe('StudentActivityListPage', () => {
  it('shows a loading message until the activities arrive', async () => {
    let resolve: (activities: ActivitySummary[]) => void = () => {}
    listActivitiesMock.mockReturnValue(new Promise((done) => (resolve = done)))
    renderPage()

    expect(await screen.findByText('Loading activities…')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Activities' })).toBeInTheDocument()

    resolve([FIZZBUZZ])

    expect(await findRows()).toHaveLength(1)
    expect(screen.queryByText('Loading activities…')).not.toBeInTheDocument()
  })

  it('loads the list with the signed-in token and an abort signal', async () => {
    listActivitiesMock.mockResolvedValue([])
    renderPage()

    await screen.findByText('No activities are available yet. Check back later.')
    expect(listActivitiesMock).toHaveBeenCalledExactlyOnceWith(TOKEN, expect.any(AbortSignal))
  })

  it('shows one row per activity in the order the server sends', async () => {
    listActivitiesMock.mockResolvedValue([SUM, FIZZBUZZ])
    renderPage()

    const rows = await findRows()

    expect(rows).toHaveLength(2)
    expect(rows.map((row) => within(row).getByRole('heading', { level: 2 }).textContent)).toEqual([
      'Sum two numbers',
      'FizzBuzz',
    ])
  })

  it.each([
    [0, '0 tests'],
    [1, '1 test'],
    [2, '2 tests'],
  ])('shows a count of %i as "%s"', async (testCaseCount, text) => {
    listActivitiesMock.mockResolvedValue([{ ...FIZZBUZZ, testCaseCount }])
    renderPage()

    const [row] = await findRows()

    expect(within(row).getByText(text)).toBeInTheDocument()
  })

  it('links the whole row to the activity workspace', async () => {
    listActivitiesMock.mockResolvedValue([FIZZBUZZ])
    const { router } = renderPage()

    const [row] = await findRows()
    const link = within(row).getByRole('link')
    expect(link).toHaveAttribute('href', '/student/activities/2')
    expect(within(link).getByRole('heading', { level: 2, name: 'FizzBuzz' })).toBeInTheDocument()

    link.click()

    expect(await screen.findByRole('heading', { level: 1, name: 'Workspace page' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/student/activities/2')
  })

  it('shows the empty state when there are no activities', async () => {
    listActivitiesMock.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('No activities are available yet. Check back later.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Activities' })).not.toBeInTheDocument()
  })

  it('shows the server detail at the top when the list cannot be loaded', async () => {
    listActivitiesMock.mockRejectedValue(apiError(500, 'Something went wrong. Please try again.'))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
    expect(screen.queryByText('Loading activities…')).not.toBeInTheDocument()
    expect(screen.queryByText('No activities are available yet. Check back later.')).not.toBeInTheDocument()
  })

  it('shows the network message when the server cannot be reached', async () => {
    listActivitiesMock.mockRejectedValue(apiError(0, "Can't reach the server. Check your connection."))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server. Check your connection.")
  })

  it('shows a generic message for an error that is not an ApiError', async () => {
    listActivitiesMock.mockRejectedValue(new TypeError('boom'))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
  })

  it('logs out and goes to /login when the token is rejected', async () => {
    listActivitiesMock.mockRejectedValue(apiError(401, 'Unauthorized'))
    const { router } = renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Log in page' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(getToken()).toBeNull()
  })

  it('aborts the request when the page is left before it finishes', async () => {
    listActivitiesMock.mockReturnValue(new Promise(() => {}))
    const { unmount } = renderPage()

    await screen.findByText('Loading activities…')
    const signal = listActivitiesMock.mock.calls[0][1]
    expect(signal?.aborted).toBe(false)

    unmount()

    expect(signal?.aborted).toBe(true)
  })
})
