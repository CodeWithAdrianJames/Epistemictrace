import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/ApiError.ts'
import { me, type User } from '../../api/authApi.ts'
import { listActivities, type ActivitySummary } from '../../api/instructorActivitiesApi.ts'
import RequireRole from '../../app/RequireRole.tsx'
import { AuthProvider } from '../../auth/AuthProvider.tsx'
import { getToken, setToken } from '../../auth/tokenStore.ts'
import ActivityListPage from './ActivityListPage.tsx'

vi.mock('../../api/authApi.ts', () => ({
  register: vi.fn(),
  login: vi.fn(),
  me: vi.fn(),
}))

vi.mock('../../api/instructorActivitiesApi.ts', () => ({
  listActivities: vi.fn(),
}))

const meMock = vi.mocked(me)
const listActivitiesMock = vi.mocked(listActivities)

const FUTURE = '2099-01-01T00:00:00Z'
const TOKEN = 'token-1'

const INSTRUCTOR: User = {
  id: 1,
  name: 'Instructor One',
  email: 'instructor1@example.test',
  role: 'INSTRUCTOR',
  consentAccepted: false,
}

const NEWEST: ActivitySummary = {
  id: 3,
  title: 'Sum two numbers',
  status: 'DRAFT',
  testCaseCount: 2,
  updatedAt: '2026-10-21T08:01:00Z',
}

const PUBLISHED: ActivitySummary = {
  id: 2,
  title: 'FizzBuzz',
  status: 'PUBLISHED',
  testCaseCount: 1,
  updatedAt: '2026-10-11T08:00:00Z',
}

const ARCHIVED: ActivitySummary = {
  id: 1,
  title: 'Hello world',
  status: 'ARCHIVED',
  testCaseCount: 0,
  updatedAt: '2026-09-01T08:00:00Z',
}

// Same formatter the page uses: the user's locale, medium date style.
function displayDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso))
}

function apiError(status: number, detail: string): ApiError {
  return new ApiError({ status, title: `HTTP ${status}`, detail, fieldErrors: {} })
}

// The page sits behind RequireRole in the app router, so it only mounts once the stored token is confirmed.
function renderPage() {
  setToken(TOKEN, FUTURE)
  meMock.mockResolvedValue(INSTRUCTOR)
  const router = createMemoryRouter(
    [
      {
        path: '/instructor/activities',
        element: (
          <RequireRole role="INSTRUCTOR">
            <ActivityListPage />
          </RequireRole>
        ),
      },
      { path: '/instructor/activities/new', element: <h1>New activity page</h1> },
      { path: '/instructor/activities/:activityId', element: <h1>Edit activity page</h1> },
      { path: '/login', element: <h1>Log in page</h1> },
    ],
    { initialEntries: ['/instructor/activities'] },
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

describe('ActivityListPage', () => {
  it('shows a loading message until the activities arrive', async () => {
    let resolve: (activities: ActivitySummary[]) => void = () => {}
    listActivitiesMock.mockReturnValue(new Promise((done) => (resolve = done)))
    renderPage()

    expect(await screen.findByText('Loading activities…')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'My activities' })).toBeInTheDocument()

    resolve([NEWEST])

    expect(await findRows()).toHaveLength(1)
    expect(screen.queryByText('Loading activities…')).not.toBeInTheDocument()
  })

  it('loads the list with the signed-in token and an abort signal', async () => {
    listActivitiesMock.mockResolvedValue([])
    renderPage()

    await screen.findByText("You haven't created any activities yet.")
    expect(listActivitiesMock).toHaveBeenCalledExactlyOnceWith(TOKEN, expect.any(AbortSignal))
  })

  it('shows one row per activity in the order the server sends', async () => {
    listActivitiesMock.mockResolvedValue([NEWEST, PUBLISHED, ARCHIVED])
    renderPage()

    const rows = await findRows()

    expect(rows).toHaveLength(3)
    expect(rows.map((row) => within(row).getByRole('heading', { level: 2 }).textContent)).toEqual([
      'Sum two numbers',
      'FizzBuzz',
      'Hello world',
    ])
  })

  it('shows title, status label, test-case count, last updated date and an Edit link in a row', async () => {
    listActivitiesMock.mockResolvedValue([NEWEST])
    renderPage()

    const [row] = await findRows()

    expect(within(row).getByRole('heading', { level: 2, name: 'Sum two numbers' })).toBeInTheDocument()
    expect(within(row).getByText('Draft')).toBeInTheDocument()
    expect(within(row).getByText('2 test cases')).toBeInTheDocument()
    const updated = within(row).getByText(displayDate(NEWEST.updatedAt))
    expect(updated.tagName).toBe('TIME')
    expect(updated).toHaveAttribute('dateTime', NEWEST.updatedAt)
    expect(within(row).getByText(/^Updated/)).toBeInTheDocument()
    const edit = within(row).getByRole('link', { name: 'Edit Sum two numbers' })
    expect(edit).toHaveTextContent('Edit')
    expect(edit).toHaveAttribute('href', '/instructor/activities/3')
  })

  it.each([
    [NEWEST, 'Draft'],
    [PUBLISHED, 'Published'],
    [ARCHIVED, 'Archived'],
  ])('labels status %#', async (activity, label) => {
    listActivitiesMock.mockResolvedValue([activity])
    renderPage()

    const [row] = await findRows()

    expect(within(row).getByText(label)).toBeInTheDocument()
  })

  it.each([
    [0, '0 test cases'],
    [1, '1 test case'],
    [2, '2 test cases'],
    [50, '50 test cases'],
  ])('shows a count of %i as "%s"', async (testCaseCount, text) => {
    listActivitiesMock.mockResolvedValue([{ ...NEWEST, testCaseCount }])
    renderPage()

    const [row] = await findRows()

    expect(within(row).getByText(text)).toBeInTheDocument()
  })

  it('opens the edit page from the Edit link', async () => {
    listActivitiesMock.mockResolvedValue([NEWEST, PUBLISHED])
    const { router } = renderPage()

    const [, second] = await findRows()
    fireEvent.click(within(second).getByRole('link', { name: 'Edit FizzBuzz' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Edit activity page' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/instructor/activities/2')
  })

  it('shows the empty state when there are no activities', async () => {
    listActivitiesMock.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText("You haven't created any activities yet.")).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Activities' })).not.toBeInTheDocument()
  })

  it.each([
    ['with activities', [NEWEST]],
    ['with no activities', []],
  ])('shows a New activity link at the top %s', async (_name, activities) => {
    listActivitiesMock.mockResolvedValue(activities)
    const { router } = renderPage()

    const link = await screen.findByRole('link', { name: 'New activity' })
    expect(link).toHaveAttribute('href', '/instructor/activities/new')
    const heading = screen.getByRole('heading', { level: 1, name: 'My activities' })
    expect(heading.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    if (activities.length > 0) {
      const list = await screen.findByRole('list', { name: 'Activities' })
      expect(link.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }

    fireEvent.click(link)

    expect(await screen.findByRole('heading', { level: 1, name: 'New activity page' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/instructor/activities/new')
  })

  it('shows the server detail at the top when the list cannot be loaded', async () => {
    listActivitiesMock.mockRejectedValue(apiError(500, 'Something went wrong. Please try again.'))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
    expect(screen.queryByText('Loading activities…')).not.toBeInTheDocument()
    expect(screen.queryByText("You haven't created any activities yet.")).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'New activity' })).toBeInTheDocument()
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
