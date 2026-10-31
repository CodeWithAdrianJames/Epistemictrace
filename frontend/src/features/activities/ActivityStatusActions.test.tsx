import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/ApiError.ts'
import { me, type User } from '../../api/authApi.ts'
import {
  archiveActivity,
  publishActivity,
  type ActivityDetail,
} from '../../api/instructorActivitiesApi.ts'
import RequireRole from '../../app/RequireRole.tsx'
import { AuthProvider } from '../../auth/AuthProvider.tsx'
import { getToken, setToken } from '../../auth/tokenStore.ts'
import ActivityStatusActions from './ActivityStatusActions.tsx'

vi.mock('../../api/authApi.ts', () => ({
  register: vi.fn(),
  login: vi.fn(),
  me: vi.fn(),
}))

vi.mock('../../api/instructorActivitiesApi.ts', () => ({
  publishActivity: vi.fn(),
  archiveActivity: vi.fn(),
}))

const meMock = vi.mocked(me)
const publishActivityMock = vi.mocked(publishActivity)
const archiveActivityMock = vi.mocked(archiveActivity)

const FUTURE = '2099-01-01T00:00:00Z'
const TOKEN = 'token-1'

const INSTRUCTOR: User = {
  id: 1,
  name: 'Instructor One',
  email: 'instructor1@example.test',
  role: 'INSTRUCTOR',
  consentAccepted: false,
}

const DRAFT: ActivityDetail = {
  id: 5,
  title: 'Sum two numbers',
  problemStatement: 'Read two integers and print their sum.',
  starterCode: '',
  status: 'DRAFT',
  testCases: [{ id: 11, position: 1, input: '1 2\n', expectedOutput: '3\n', hidden: false }],
  createdAt: '2026-10-20T08:00:00Z',
  updatedAt: '2026-10-21T08:00:00Z',
}

const PUBLISHED: ActivityDetail = { ...DRAFT, status: 'PUBLISHED', updatedAt: '2026-10-22T08:00:00Z' }
const ARCHIVED: ActivityDetail = { ...DRAFT, status: 'ARCHIVED', updatedAt: '2026-10-23T08:00:00Z' }

const ARCHIVE_PROMPT = "Archive this activity? Archived activities can't be edited or published again."

function apiError(status: number, detail: string): ApiError {
  return new ApiError({ status, title: `HTTP ${status}`, detail, fieldErrors: {} })
}

// Holds the activity like the edit page does, so the returned activity is rendered back (R7).
function Harness({ initial }: { initial: ActivityDetail }) {
  const [activity, setActivity] = useState(initial)
  return <ActivityStatusActions activity={activity} onStatusChange={setActivity} />
}

function renderActions(initial: ActivityDetail) {
  setToken(TOKEN, FUTURE)
  meMock.mockResolvedValue(INSTRUCTOR)
  const router = createMemoryRouter(
    [
      {
        path: '/instructor/activities/:activityId',
        element: (
          <RequireRole role="INSTRUCTOR">
            <Harness initial={initial} />
          </RequireRole>
        ),
      },
      { path: '/login', element: <h1>Log in page</h1> },
    ],
    { initialEntries: [`/instructor/activities/${initial.id}`] },
  )
  const view = render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
  return { router, ...view }
}

async function findSection(): Promise<HTMLElement> {
  return screen.findByRole('region', { name: 'Status' })
}

function button(section: HTMLElement, name: string): HTMLElement {
  return within(section).getByRole('button', { name })
}

function queryButton(section: HTMLElement, name: string): HTMLElement | null {
  return within(section).queryByRole('button', { name })
}

function confirmWith(answer: boolean) {
  return vi.spyOn(window, 'confirm').mockReturnValue(answer)
}

afterEach(() => {
  vi.resetAllMocks()
  vi.restoreAllMocks()
  sessionStorage.clear()
})

describe('ActivityStatusActions', () => {
  describe('buttons per status', () => {
    it('offers Publish and Archive for a draft with a test case', async () => {
      renderActions(DRAFT)

      const section = await findSection()
      expect(button(section, 'Publish')).toBeEnabled()
      expect(button(section, 'Archive')).toBeEnabled()
      expect(within(section).queryByText('Add at least one test case')).not.toBeInTheDocument()
      expect(within(section).queryByText("Archived activities can't be edited.")).not.toBeInTheDocument()
    })

    it('disables Publish with a visible reason for a draft without test cases', async () => {
      renderActions({ ...DRAFT, testCases: [] })

      const section = await findSection()
      const publish = button(section, 'Publish')
      expect(publish).toBeDisabled()
      expect(within(section).getByText('Add at least one test case')).toBeVisible()
      expect(publish).toHaveAccessibleDescription('Add at least one test case')
      expect(button(section, 'Archive')).toBeEnabled()
    })

    it('offers only Archive for a published activity', async () => {
      renderActions(PUBLISHED)

      const section = await findSection()
      expect(queryButton(section, 'Publish')).not.toBeInTheDocument()
      expect(button(section, 'Archive')).toBeEnabled()
      expect(within(section).queryByText("Archived activities can't be edited.")).not.toBeInTheDocument()
    })

    it('offers no actions and shows the read-only note for an archived activity', async () => {
      renderActions(ARCHIVED)

      const section = await findSection()
      expect(within(section).queryAllByRole('button')).toHaveLength(0)
      expect(within(section).getByText("Archived activities can't be edited.")).toBeVisible()
    })
  })

  describe('publish', () => {
    it('publishes with the token and id, then shows the returned status', async () => {
      publishActivityMock.mockResolvedValue(PUBLISHED)
      renderActions(DRAFT)

      const section = await findSection()
      fireEvent.click(button(section, 'Publish'))

      expect(await within(section).findByRole('button', { name: 'Archive' })).toBeEnabled()
      expect(queryButton(section, 'Publish')).not.toBeInTheDocument()
      expect(publishActivityMock).toHaveBeenCalledExactlyOnceWith(TOKEN, 5)
    })

    it('does not ask for confirmation before publishing', async () => {
      const confirm = confirmWith(false)
      publishActivityMock.mockResolvedValue(PUBLISHED)
      renderActions(DRAFT)

      const section = await findSection()
      fireEvent.click(button(section, 'Publish'))

      await within(section).findByRole('button', { name: 'Archive' })
      expect(confirm).not.toHaveBeenCalled()
    })

    it('takes the status from the response, not from the button that was pressed', async () => {
      publishActivityMock.mockResolvedValue(ARCHIVED)
      renderActions(DRAFT)

      const section = await findSection()
      fireEvent.click(button(section, 'Publish'))

      expect(await within(section).findByText("Archived activities can't be edited.")).toBeInTheDocument()
      expect(within(section).queryAllByRole('button')).toHaveLength(0)
    })

    it('shows a 409 detail at the top of the status section and keeps the draft actions', async () => {
      publishActivityMock.mockRejectedValue(apiError(409, 'Add at least one test case before publishing.'))
      renderActions(DRAFT)

      const section = await findSection()
      fireEvent.click(button(section, 'Publish'))

      const alert = await within(section).findByRole('alert')
      expect(alert).toHaveTextContent('Add at least one test case before publishing.')
      expect(within(section).getByRole('heading', { name: 'Status' }).nextElementSibling).toBe(alert)
      expect(button(section, 'Publish')).toBeEnabled()
      expect(button(section, 'Archive')).toBeEnabled()
    })

    it('shows a fixed message for an error that is not an ApiError', async () => {
      publishActivityMock.mockRejectedValue(new TypeError('boom'))
      renderActions(DRAFT)

      const section = await findSection()
      fireEvent.click(button(section, 'Publish'))

      expect(await within(section).findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
    })

    it('disables both buttons while the request runs and ignores a second click', async () => {
      let resolve: (activity: ActivityDetail) => void = () => {}
      publishActivityMock.mockReturnValue(new Promise((done) => (resolve = done)))
      renderActions(DRAFT)

      const section = await findSection()
      const publish = button(section, 'Publish')
      fireEvent.click(publish)

      expect(publish).toBeDisabled()
      expect(button(section, 'Archive')).toBeDisabled()
      fireEvent.click(publish)
      expect(publishActivityMock).toHaveBeenCalledTimes(1)

      resolve(PUBLISHED)

      expect(await within(section).findByRole('button', { name: 'Archive' })).toBeEnabled()
    })

    it('does not send a publish for a draft without test cases', async () => {
      renderActions({ ...DRAFT, testCases: [] })

      const section = await findSection()
      fireEvent.click(button(section, 'Publish'))

      expect(publishActivityMock).not.toHaveBeenCalled()
    })

    it('sends the user to /login when the token is rejected', async () => {
      publishActivityMock.mockRejectedValue(apiError(401, 'Unauthorized'))
      const { router } = renderActions(DRAFT)

      const section = await findSection()
      fireEvent.click(button(section, 'Publish'))

      expect(await screen.findByRole('heading', { name: 'Log in page' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/login')
      expect(getToken()).toBeNull()
    })
  })

  describe('archive', () => {
    it('asks for confirmation and sends nothing when cancelled', async () => {
      const confirm = confirmWith(false)
      renderActions(DRAFT)

      const section = await findSection()
      fireEvent.click(button(section, 'Archive'))

      expect(confirm).toHaveBeenCalledExactlyOnceWith(ARCHIVE_PROMPT)
      expect(archiveActivityMock).not.toHaveBeenCalled()
      expect(button(section, 'Archive')).toBeEnabled()
    })

    it('archives a draft after confirmation and shows the read-only note', async () => {
      confirmWith(true)
      archiveActivityMock.mockResolvedValue(ARCHIVED)
      renderActions(DRAFT)

      const section = await findSection()
      fireEvent.click(button(section, 'Archive'))

      expect(await within(section).findByText("Archived activities can't be edited.")).toBeInTheDocument()
      expect(within(section).queryAllByRole('button')).toHaveLength(0)
      expect(archiveActivityMock).toHaveBeenCalledExactlyOnceWith(TOKEN, 5)
    })

    it('archives a published activity after confirmation', async () => {
      const confirm = confirmWith(true)
      archiveActivityMock.mockResolvedValue(ARCHIVED)
      renderActions(PUBLISHED)

      const section = await findSection()
      fireEvent.click(button(section, 'Archive'))

      expect(await within(section).findByText("Archived activities can't be edited.")).toBeInTheDocument()
      expect(confirm).toHaveBeenCalledExactlyOnceWith(ARCHIVE_PROMPT)
      expect(archiveActivityMock).toHaveBeenCalledExactlyOnceWith(TOKEN, 5)
    })

    it('shows a 409 detail at the top of the status section and keeps the actions', async () => {
      confirmWith(true)
      archiveActivityMock.mockRejectedValue(apiError(409, 'Activity is already archived.'))
      renderActions(PUBLISHED)

      const section = await findSection()
      fireEvent.click(button(section, 'Archive'))

      const alert = await within(section).findByRole('alert')
      expect(alert).toHaveTextContent('Activity is already archived.')
      expect(within(section).getByRole('heading', { name: 'Status' }).nextElementSibling).toBe(alert)
      expect(button(section, 'Archive')).toBeEnabled()
    })

    it('clears the section error when the next action starts', async () => {
      confirmWith(true)
      archiveActivityMock.mockRejectedValueOnce(apiError(409, 'Try again later.'))
      let resolve: (activity: ActivityDetail) => void = () => {}
      archiveActivityMock.mockReturnValueOnce(new Promise((done) => (resolve = done)))
      renderActions(PUBLISHED)

      const section = await findSection()
      fireEvent.click(button(section, 'Archive'))
      await within(section).findByRole('alert')

      fireEvent.click(button(section, 'Archive'))

      expect(within(section).queryByRole('alert')).not.toBeInTheDocument()
      resolve(ARCHIVED)
      expect(await within(section).findByText("Archived activities can't be edited.")).toBeInTheDocument()
    })

    it('disables both buttons while the request runs and ignores a second click', async () => {
      const confirm = confirmWith(true)
      let resolve: (activity: ActivityDetail) => void = () => {}
      archiveActivityMock.mockReturnValue(new Promise((done) => (resolve = done)))
      renderActions(DRAFT)

      const section = await findSection()
      const archive = button(section, 'Archive')
      fireEvent.click(archive)

      expect(archive).toBeDisabled()
      expect(button(section, 'Publish')).toBeDisabled()
      fireEvent.click(archive)
      expect(confirm).toHaveBeenCalledTimes(1)
      expect(archiveActivityMock).toHaveBeenCalledTimes(1)

      resolve(ARCHIVED)

      expect(await within(section).findByText("Archived activities can't be edited.")).toBeInTheDocument()
    })

    it('sends the user to /login when the token is rejected', async () => {
      confirmWith(true)
      archiveActivityMock.mockRejectedValue(apiError(401, 'Unauthorized'))
      const { router } = renderActions(PUBLISHED)

      const section = await findSection()
      fireEvent.click(button(section, 'Archive'))

      expect(await screen.findByRole('heading', { name: 'Log in page' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/login')
      expect(getToken()).toBeNull()
    })
  })
})
