import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/ApiError.ts'
import { me, type User } from '../../api/authApi.ts'
import { createActivity, type ActivityDetail } from '../../api/instructorActivitiesApi.ts'
import RequireRole from '../../app/RequireRole.tsx'
import { AuthProvider } from '../../auth/AuthProvider.tsx'
import { getToken, setToken } from '../../auth/tokenStore.ts'
import formStyles from './ActivityForm.module.css'
import ActivityNewPage from './ActivityNewPage.tsx'

vi.mock('../../api/authApi.ts', () => ({
  register: vi.fn(),
  login: vi.fn(),
  me: vi.fn(),
}))

vi.mock('../../api/instructorActivitiesApi.ts', () => ({
  createActivity: vi.fn(),
}))

const meMock = vi.mocked(me)
const createActivityMock = vi.mocked(createActivity)

const FUTURE = '2099-01-01T00:00:00Z'
const TOKEN = 'token-1'

const INSTRUCTOR: User = {
  id: 1,
  name: 'Instructor One',
  email: 'instructor1@example.test',
  role: 'INSTRUCTOR',
  consentAccepted: false,
}

const CREATED: ActivityDetail = {
  id: 9,
  title: 'Sum two numbers',
  problemStatement: 'Read two integers\nand print their sum.',
  starterCode: 'a = int(input())\n',
  status: 'DRAFT',
  testCases: [],
  createdAt: '2026-10-31T08:00:00Z',
  updatedAt: '2026-10-31T08:00:00Z',
}

function apiError(status: number, detail: string, fieldErrors: Record<string, string> = {}): ApiError {
  return new ApiError({ status, title: `HTTP ${status}`, detail, fieldErrors })
}

function renderPage() {
  setToken(TOKEN, FUTURE)
  meMock.mockResolvedValue(INSTRUCTOR)
  const router = createMemoryRouter(
    [
      {
        path: '/instructor/activities/new',
        element: (
          <RequireRole role="INSTRUCTOR">
            <ActivityNewPage />
          </RequireRole>
        ),
      },
      { path: '/instructor/activities/:activityId', element: <h1>Edit activity page</h1> },
      { path: '/login', element: <h1>Log in page</h1> },
    ],
    { initialEntries: ['/instructor/activities', '/instructor/activities/new'], initialIndex: 1 },
  )
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
  return router
}

async function findField(label: string): Promise<HTMLElement> {
  return screen.findByRole('textbox', { name: label })
}

function type(field: HTMLElement, value: string) {
  fireEvent.change(field, { target: { value } })
}

async function fillValid() {
  type(await findField('Title'), '  Sum two numbers  ')
  type(await findField('Problem statement'), 'Read two integers\nand print their sum.')
  type(await findField('Starter code'), 'a = int(input())\n')
}

function clickCreate() {
  fireEvent.click(screen.getByRole('button', { name: 'Create' }))
}

afterEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
})

describe('ActivityNewPage', () => {
  it('shows the three empty fields and a Create button', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'New activity' })).toBeInTheDocument()
    expect(await findField('Title')).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Problem statement' })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Starter code' })).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled()
  })

  it('uses textareas for the problem statement and the starter code, with a mono font for code', async () => {
    renderPage()

    const title = await findField('Title')
    const problem = screen.getByRole('textbox', { name: 'Problem statement' })
    const starter = screen.getByRole('textbox', { name: 'Starter code' })

    expect(title.tagName).toBe('INPUT')
    expect(problem.tagName).toBe('TEXTAREA')
    expect(starter.tagName).toBe('TEXTAREA')
    expect(starter).toHaveClass(formStyles.code)
    expect(problem).not.toHaveClass(formStyles.code)
  })

  it('creates the activity with the trimmed title and opens its edit page', async () => {
    createActivityMock.mockResolvedValue(CREATED)
    const router = renderPage()

    await fillValid()
    clickCreate()

    expect(await screen.findByRole('heading', { level: 1, name: 'Edit activity page' })).toBeInTheDocument()
    expect(createActivityMock).toHaveBeenCalledExactlyOnceWith(TOKEN, {
      title: 'Sum two numbers',
      problemStatement: 'Read two integers\nand print their sum.',
      starterCode: 'a = int(input())\n',
    })
    expect(router.state.location.pathname).toBe('/instructor/activities/9')
    expect(router.state.historyAction).toBe('REPLACE')
  })

  it('sends empty starter code when the field is left blank', async () => {
    createActivityMock.mockResolvedValue({ ...CREATED, starterCode: '' })
    renderPage()

    type(await findField('Title'), 'Sum')
    type(screen.getByRole('textbox', { name: 'Problem statement' }), 'Add them.')
    clickCreate()

    await screen.findByRole('heading', { level: 1, name: 'Edit activity page' })
    expect(createActivityMock).toHaveBeenCalledExactlyOnceWith(TOKEN, {
      title: 'Sum',
      problemStatement: 'Add them.',
      starterCode: '',
    })
  })

  it('shows the client checks under their fields and sends nothing', async () => {
    renderPage()

    await findField('Title')
    clickCreate()

    const title = screen.getByRole('textbox', { name: 'Title' })
    const problem = screen.getByRole('textbox', { name: 'Problem statement' })
    expect(title).toHaveAccessibleDescription('Enter a title.')
    expect(title).toHaveAttribute('aria-invalid', 'true')
    expect(problem).toHaveAccessibleDescription('Enter a problem statement.')
    expect(screen.getByRole('textbox', { name: 'Starter code' })).not.toHaveAttribute('aria-invalid')
    expect(createActivityMock).not.toHaveBeenCalled()
  })

  it('enforces the length limits before sending', async () => {
    renderPage()

    type(await findField('Title'), 'a'.repeat(121))
    type(screen.getByRole('textbox', { name: 'Problem statement' }), 'a'.repeat(20_001))
    type(screen.getByRole('textbox', { name: 'Starter code' }), 'a'.repeat(20_001))
    clickCreate()

    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveAccessibleDescription(
      'Title must be 120 characters or fewer.',
    )
    expect(screen.getByRole('textbox', { name: 'Problem statement' })).toHaveAccessibleDescription(
      'Problem statement must be 20,000 characters or fewer.',
    )
    expect(screen.getByRole('textbox', { name: 'Starter code' })).toHaveAccessibleDescription(
      'Starter code must be 20,000 characters or fewer.',
    )
    expect(createActivityMock).not.toHaveBeenCalled()
  })

  it('shows server field errors under their fields and stays on the page', async () => {
    createActivityMock.mockRejectedValue(
      apiError(400, 'Validation failed.', {
        title: 'size must be between 0 and 120',
        problemStatement: 'must not be blank',
        starterCode: 'size must be between 0 and 20000',
      }),
    )
    const router = renderPage()

    await fillValid()
    clickCreate()

    expect(await screen.findByText('size must be between 0 and 120')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveAccessibleDescription('size must be between 0 and 120')
    expect(screen.getByRole('textbox', { name: 'Problem statement' })).toHaveAccessibleDescription('must not be blank')
    expect(screen.getByRole('textbox', { name: 'Starter code' })).toHaveAccessibleDescription(
      'size must be between 0 and 20000',
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/instructor/activities/new')
    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled()
  })

  it('shows any other API error at the top of the form', async () => {
    createActivityMock.mockRejectedValue(apiError(500, 'The server could not handle the request.'))
    renderPage()

    await fillValid()
    clickCreate()

    expect(await screen.findByRole('alert')).toHaveTextContent('The server could not handle the request.')
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('  Sum two numbers  ')
  })

  it('shows a fixed message for an error that is not an ApiError', async () => {
    createActivityMock.mockRejectedValue(new TypeError('boom'))
    renderPage()

    await fillValid()
    clickCreate()

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
  })

  it('clears earlier errors when the form is sent again', async () => {
    createActivityMock.mockRejectedValueOnce(apiError(500, 'The server could not handle the request.'))
    createActivityMock.mockResolvedValueOnce(CREATED)
    renderPage()

    await findField('Title')
    clickCreate()
    expect(screen.getByText('Enter a title.')).toBeInTheDocument()

    await fillValid()
    clickCreate()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Enter a title.')).not.toBeInTheDocument()

    clickCreate()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 1, name: 'Edit activity page' })).toBeInTheDocument()
  })

  it('disables Create while the request runs and ignores a second submit', async () => {
    let resolve: (activity: ActivityDetail) => void = () => {}
    createActivityMock.mockReturnValue(new Promise((done) => (resolve = done)))
    renderPage()

    await fillValid()
    clickCreate()
    const button = screen.getByRole('button', { name: 'Create' })
    expect(button).toBeDisabled()
    fireEvent.submit(button.closest('form') as HTMLFormElement)
    expect(createActivityMock).toHaveBeenCalledTimes(1)

    resolve(CREATED)
    expect(await screen.findByRole('heading', { level: 1, name: 'Edit activity page' })).toBeInTheDocument()
  })

  it('sends the user to /login when the token is rejected', async () => {
    createActivityMock.mockRejectedValue(apiError(401, 'Authentication required.'))
    const router = renderPage()

    await fillValid()
    clickCreate()

    expect(await screen.findByRole('heading', { level: 1, name: 'Log in page' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(getToken()).toBeNull()
  })
})
