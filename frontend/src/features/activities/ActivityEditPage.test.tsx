import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/ApiError.ts'
import { me, type User } from '../../api/authApi.ts'
import { getActivity, updateActivity, type ActivityDetail } from '../../api/instructorActivitiesApi.ts'
import RequireRole from '../../app/RequireRole.tsx'
import { AuthProvider } from '../../auth/AuthProvider.tsx'
import { getToken, setToken } from '../../auth/tokenStore.ts'
import formStyles from './ActivityForm.module.css'
import ActivityEditPage from './ActivityEditPage.tsx'

vi.mock('../../api/authApi.ts', () => ({
  register: vi.fn(),
  login: vi.fn(),
  me: vi.fn(),
}))

vi.mock('../../api/instructorActivitiesApi.ts', () => ({
  getActivity: vi.fn(),
  updateActivity: vi.fn(),
}))

const meMock = vi.mocked(me)
const getActivityMock = vi.mocked(getActivity)
const updateActivityMock = vi.mocked(updateActivity)

const FUTURE = '2099-01-01T00:00:00Z'
const TOKEN = 'token-1'

const INSTRUCTOR: User = {
  id: 1,
  name: 'Instructor One',
  email: 'instructor1@example.test',
  role: 'INSTRUCTOR',
  consentAccepted: false,
}

const ACTIVITY: ActivityDetail = {
  id: 5,
  title: 'Sum two numbers',
  problemStatement: 'Read two integers\nand print their sum.',
  starterCode: 'a = int(input())\n',
  status: 'DRAFT',
  testCases: [{ id: 11, position: 1, input: '1 2\n', expectedOutput: '3\n', hidden: false }],
  createdAt: '2026-10-20T08:00:00Z',
  updatedAt: '2026-10-21T08:00:00Z',
}

function apiError(status: number, detail: string, fieldErrors: Record<string, string> = {}): ApiError {
  return new ApiError({ status, title: `HTTP ${status}`, detail, fieldErrors })
}

function renderPage(path = '/instructor/activities/5') {
  setToken(TOKEN, FUTURE)
  meMock.mockResolvedValue(INSTRUCTOR)
  const router = createMemoryRouter(
    [
      {
        path: '/instructor/activities/:activityId',
        element: (
          <RequireRole role="INSTRUCTOR">
            <ActivityEditPage />
          </RequireRole>
        ),
      },
      { path: '/instructor/activities', element: <h1>Activity list page</h1> },
      { path: '/login', element: <h1>Log in page</h1> },
    ],
    { initialEntries: [path] },
  )
  const view = render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
  return { router, ...view }
}

async function findDetails(): Promise<HTMLElement> {
  return screen.findByRole('region', { name: 'Details' })
}

function field(label: string): HTMLElement {
  return screen.getByRole('textbox', { name: label })
}

function type(element: HTMLElement, value: string) {
  fireEvent.change(element, { target: { value } })
}

function saveButton(): HTMLElement {
  return screen.getByRole('button', { name: 'Save changes' })
}

afterEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
})

describe('ActivityEditPage', () => {
  it('shows a loading message until the activity arrives', async () => {
    let resolve: (activity: ActivityDetail) => void = () => {}
    getActivityMock.mockReturnValue(new Promise((done) => (resolve = done)))
    renderPage()

    expect(await screen.findByText('Loading activity…')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Edit activity' })).toBeInTheDocument()

    resolve(ACTIVITY)

    expect(await findDetails()).toBeInTheDocument()
    expect(screen.queryByText('Loading activity…')).not.toBeInTheDocument()
  })

  it('loads the activity from the route with the signed-in token and an abort signal', async () => {
    getActivityMock.mockResolvedValue(ACTIVITY)
    renderPage()

    await findDetails()
    expect(getActivityMock).toHaveBeenCalledExactlyOnceWith(TOKEN, 5, expect.any(AbortSignal))
  })

  it('fills the three fields with the saved values', async () => {
    getActivityMock.mockResolvedValue(ACTIVITY)
    renderPage()

    await findDetails()
    expect(field('Title')).toHaveValue('Sum two numbers')
    expect(field('Problem statement')).toHaveValue('Read two integers\nand print their sum.')
    expect(field('Starter code')).toHaveValue('a = int(input())\n')
    expect(field('Problem statement').tagName).toBe('TEXTAREA')
    expect(field('Starter code').tagName).toBe('TEXTAREA')
    expect(field('Starter code')).toHaveClass(formStyles.code)
  })

  it.each([
    ['DRAFT', 'Draft'],
    ['PUBLISHED', 'Published'],
    ['ARCHIVED', 'Archived'],
  ] as const)('shows the status label for %s', async (status, label) => {
    getActivityMock.mockResolvedValue({ ...ACTIVITY, status })
    renderPage()

    await findDetails()
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('enables Save changes only while a field differs from the saved value', async () => {
    getActivityMock.mockResolvedValue(ACTIVITY)
    renderPage()

    await findDetails()
    expect(saveButton()).toBeDisabled()

    type(field('Title'), 'Sum three numbers')
    expect(saveButton()).toBeEnabled()

    type(field('Title'), 'Sum two numbers')
    expect(saveButton()).toBeDisabled()

    type(field('Problem statement'), 'Changed')
    expect(saveButton()).toBeEnabled()
    type(field('Problem statement'), ACTIVITY.problemStatement)

    type(field('Starter code'), '')
    expect(saveButton()).toBeEnabled()
  })

  it('saves the changed fields and then shows what the server returned', async () => {
    getActivityMock.mockResolvedValue(ACTIVITY)
    updateActivityMock.mockResolvedValue({
      ...ACTIVITY,
      title: 'Sum three numbers',
      starterCode: '',
      updatedAt: '2026-10-31T09:00:00Z',
    })
    renderPage()

    await findDetails()
    type(field('Title'), '  Sum three numbers  ')
    type(field('Starter code'), '')
    fireEvent.click(saveButton())

    expect(await screen.findByRole('status')).toHaveTextContent('Changes saved.')
    expect(updateActivityMock).toHaveBeenCalledExactlyOnceWith(TOKEN, 5, {
      title: 'Sum three numbers',
      problemStatement: 'Read two integers\nand print their sum.',
      starterCode: '',
    })
    expect(field('Title')).toHaveValue('Sum three numbers')
    expect(field('Starter code')).toHaveValue('')
    expect(saveButton()).toBeDisabled()
  })

  it('takes the saved values from the response, not from the form', async () => {
    getActivityMock.mockResolvedValue(ACTIVITY)
    updateActivityMock.mockResolvedValue({ ...ACTIVITY, title: 'Title chosen by the server', status: 'PUBLISHED' })
    renderPage()

    await findDetails()
    type(field('Title'), 'Typed title')
    fireEvent.click(saveButton())

    expect(await screen.findByRole('status')).toBeInTheDocument()
    expect(field('Title')).toHaveValue('Title chosen by the server')
    expect(screen.getByText('Published')).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  it('hides the saved message as soon as a field changes again', async () => {
    getActivityMock.mockResolvedValue(ACTIVITY)
    updateActivityMock.mockResolvedValue({ ...ACTIVITY, title: 'Sum three numbers' })
    renderPage()

    await findDetails()
    type(field('Title'), 'Sum three numbers')
    fireEvent.click(saveButton())
    await screen.findByRole('status')

    type(field('Title'), 'Sum four numbers')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows the client checks under their fields and sends nothing', async () => {
    getActivityMock.mockResolvedValue(ACTIVITY)
    renderPage()

    await findDetails()
    type(field('Title'), '   ')
    type(field('Problem statement'), 'a'.repeat(20_001))
    type(field('Starter code'), 'a'.repeat(20_001))
    fireEvent.click(saveButton())

    expect(field('Title')).toHaveAccessibleDescription('Enter a title.')
    expect(field('Title')).toHaveAttribute('aria-invalid', 'true')
    expect(field('Problem statement')).toHaveAccessibleDescription(
      'Problem statement must be 20,000 characters or fewer.',
    )
    expect(field('Starter code')).toHaveAccessibleDescription('Starter code must be 20,000 characters or fewer.')
    expect(updateActivityMock).not.toHaveBeenCalled()
  })

  it('shows server field errors under their fields and keeps the typed values', async () => {
    getActivityMock.mockResolvedValue(ACTIVITY)
    updateActivityMock.mockRejectedValue(
      apiError(400, 'Validation failed.', { title: 'size must be between 0 and 120' }),
    )
    renderPage()

    await findDetails()
    type(field('Title'), 'Server rejects this')
    fireEvent.click(saveButton())

    expect(await screen.findByText('size must be between 0 and 120')).toBeInTheDocument()
    expect(field('Title')).toHaveAccessibleDescription('size must be between 0 and 120')
    expect(field('Title')).toHaveValue('Server rejects this')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(saveButton()).toBeEnabled()
  })

  it('shows a 409 detail at the top of the details section', async () => {
    getActivityMock.mockResolvedValue({ ...ACTIVITY, status: 'ARCHIVED' })
    updateActivityMock.mockRejectedValue(apiError(409, "Archived activities can't be edited."))
    renderPage()

    const details = await findDetails()
    type(field('Title'), 'Sum three numbers')
    fireEvent.click(saveButton())

    const alert = await within(details).findByRole('alert')
    expect(alert).toHaveTextContent("Archived activities can't be edited.")
    expect(details.firstElementChild?.nextElementSibling).toBe(alert)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows a fixed message for an error that is not an ApiError', async () => {
    getActivityMock.mockResolvedValue(ACTIVITY)
    updateActivityMock.mockRejectedValue(new TypeError('boom'))
    renderPage()

    const details = await findDetails()
    type(field('Title'), 'Sum three numbers')
    fireEvent.click(saveButton())

    expect(await within(details).findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
  })

  it('clears the section error when the form is sent again', async () => {
    getActivityMock.mockResolvedValue(ACTIVITY)
    updateActivityMock.mockRejectedValueOnce(apiError(500, 'The server could not handle the request.'))
    updateActivityMock.mockResolvedValueOnce({ ...ACTIVITY, title: 'Sum three numbers' })
    renderPage()

    await findDetails()
    type(field('Title'), 'Sum three numbers')
    fireEvent.click(saveButton())
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    fireEvent.click(saveButton())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Changes saved.')
  })

  it('disables Save changes while the request runs and ignores a second submit', async () => {
    let resolve: (activity: ActivityDetail) => void = () => {}
    getActivityMock.mockResolvedValue(ACTIVITY)
    updateActivityMock.mockReturnValue(new Promise((done) => (resolve = done)))
    renderPage()

    await findDetails()
    type(field('Title'), 'Sum three numbers')
    fireEvent.click(saveButton())
    expect(saveButton()).toBeDisabled()
    fireEvent.submit(saveButton().closest('form') as HTMLFormElement)
    expect(updateActivityMock).toHaveBeenCalledTimes(1)

    resolve({ ...ACTIVITY, title: 'Sum three numbers' })
    expect(await screen.findByRole('status')).toBeInTheDocument()
  })

  it('does not send an unchanged form', async () => {
    getActivityMock.mockResolvedValue(ACTIVITY)
    renderPage()

    await findDetails()
    fireEvent.submit(saveButton().closest('form') as HTMLFormElement)

    expect(updateActivityMock).not.toHaveBeenCalled()
  })

  it('shows the load error and no form when the activity cannot be loaded', async () => {
    getActivityMock.mockRejectedValue(apiError(404, 'Activity not found.'))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Activity not found.')
    expect(screen.queryByRole('region', { name: 'Details' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Edit activity' })).toBeInTheDocument()
  })

  it('shows a fixed message when loading fails with an error that is not an ApiError', async () => {
    getActivityMock.mockRejectedValue(new TypeError('boom'))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
  })

  it.each(['abc', '0', '-3', '1.5', '9007199254740993'])(
    'shows "Activity not found." for the id %s without a request',
    async (id) => {
      renderPage(`/instructor/activities/${id}`)

      expect(await screen.findByRole('alert')).toHaveTextContent('Activity not found.')
      expect(getActivityMock).not.toHaveBeenCalled()
    },
  )

  it('sends the user to /login when the token is rejected on load', async () => {
    getActivityMock.mockRejectedValue(apiError(401, 'Authentication required.'))
    const { router } = renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Log in page' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(getToken()).toBeNull()
  })

  it('sends the user to /login when the token is rejected on save', async () => {
    getActivityMock.mockResolvedValue(ACTIVITY)
    updateActivityMock.mockRejectedValue(apiError(401, 'Authentication required.'))
    const { router } = renderPage()

    await findDetails()
    type(field('Title'), 'Sum three numbers')
    fireEvent.click(saveButton())

    expect(await screen.findByRole('heading', { level: 1, name: 'Log in page' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(getToken()).toBeNull()
  })

  it('aborts the load when the page unmounts', async () => {
    getActivityMock.mockReturnValue(new Promise(() => {}))
    const { unmount } = renderPage()

    await screen.findByText('Loading activity…')
    const signal = getActivityMock.mock.calls[0][2] as AbortSignal
    expect(signal.aborted).toBe(false)

    unmount()

    expect(signal.aborted).toBe(true)
  })

  it('loads the new activity when the route id changes', async () => {
    getActivityMock.mockImplementation((_token, activityId) =>
      Promise.resolve({ ...ACTIVITY, id: activityId, title: `Activity ${activityId}` }),
    )
    const { router } = renderPage()

    await findDetails()
    expect(field('Title')).toHaveValue('Activity 5')
    type(field('Title'), 'Unsaved edit')

    await act(() => router.navigate('/instructor/activities/6'))

    expect(await screen.findByDisplayValue('Activity 6')).toBeInTheDocument()
    expect(getActivityMock).toHaveBeenLastCalledWith(TOKEN, 6, expect.any(AbortSignal))
    expect(saveButton()).toBeDisabled()
  })
})
