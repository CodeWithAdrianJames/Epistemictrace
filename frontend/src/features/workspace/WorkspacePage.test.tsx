import Editor, { type EditorProps, type OnChange } from '@monaco-editor/react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getActivity, type ActivityDetail } from '../../api/activitiesApi.ts'
import { ApiError } from '../../api/ApiError.ts'
import { me, type User } from '../../api/authApi.ts'
import RequireRole from '../../app/RequireRole.tsx'
import { AuthProvider } from '../../auth/AuthProvider.tsx'
import { setToken } from '../../auth/tokenStore.ts'
import { createPythonRunner, type ExecutionResult, type PythonRunner } from '../runner/pythonRunner.ts'
import type { EditorChange } from './CodeEditor.tsx'
import WorkspacePage from './WorkspacePage.tsx'

vi.mock('../../api/authApi.ts', () => ({
  register: vi.fn(),
  login: vi.fn(),
  me: vi.fn(),
}))

vi.mock('../../api/activitiesApi.ts', () => ({
  listActivities: vi.fn(),
  getActivity: vi.fn(),
}))

// Monaco needs a real browser (and loads from a CDN), so the wrapper is replaced by a spy on its props.
vi.mock('@monaco-editor/react', () => ({
  default: vi.fn(() => <div data-testid="monaco-editor" />),
}))

// The real runner starts a Web Worker, which jsdom does not have; the page only needs its three methods.
vi.mock('../runner/pythonRunner.ts', () => ({
  createPythonRunner: vi.fn(),
}))

const createRunnerMock = vi.mocked(createPythonRunner)
const meMock = vi.mocked(me)
const getActivityMock = vi.mocked(getActivity)
const EditorMock = vi.mocked(Editor)

type ContentChangedEvent = Parameters<OnChange>[1]

const FUTURE = '2099-01-01T00:00:00Z'

const STUDENT: User = {
  id: 7,
  name: 'Student One',
  email: 'student1@example.test',
  role: 'STUDENT',
  consentAccepted: false,
}

const ACTIVITY: ActivityDetail = {
  id: 42,
  title: 'Sum of two numbers',
  problemStatement: 'Read two numbers.\nPrint their sum.',
  starterCode: 'a = int(input())\n',
  status: 'PUBLISHED',
  testCases: [
    { id: 1, position: 1, input: '3\n4', expectedOutput: '7', hidden: false },
    { id: 2, position: 2, input: '10\n-2', expectedOutput: '8', hidden: true },
  ],
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-02T00:00:00Z',
}

function notFound(): ApiError {
  return new ApiError({ status: 404, title: 'Not Found', detail: 'Activity not found.', fieldErrors: {} })
}

function lastProps(): EditorProps {
  const call = EditorMock.mock.lastCall
  if (!call) {
    throw new Error('Editor was not rendered')
  }
  return call[0]
}

function type(value: string, text: string, rangeLength = 0): void {
  const onChange = lastProps().onChange
  if (!onChange) {
    throw new Error('Editor has no onChange')
  }
  act(() => {
    onChange(value, { changes: [{ text, rangeLength }] } as unknown as ContentChangedEvent)
  })
}

interface RenderOptions {
  onEditorChange?: (value: string, change: EditorChange) => void
}

type FakeRunner = { [K in keyof PythonRunner]: ReturnType<typeof vi.fn<PythonRunner[K]>> }

let runner: FakeRunner
let finishWarmUp: { resolve: () => void; reject: (error: Error) => void }

// Warm-up stays pending until a test calls warmUpDone(); runs answer '7' by default.
function installRunner(): void {
  runner = {
    warmUp: vi.fn(
      () =>
        new Promise<void>((resolve, reject) => {
          finishWarmUp = { resolve, reject }
        }),
    ),
    run: vi.fn(async (): Promise<ExecutionResult> => ({ status: 'ok', stdout: '7\n' })),
    dispose: vi.fn(),
  }
  createRunnerMock.mockReturnValue(runner)
}

async function warmUpDone(): Promise<void> {
  await act(async () => finishWarmUp.resolve())
}

// Clicks Run tests and waits until the run has finished (the button reads Run tests again), so
// assertions do not depend on how many microtasks runTests needs.
async function runTestsAndWait(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Run tests' }))
  expect(screen.getByRole('button', { name: 'Running…' })).toBeDisabled()
  await screen.findByRole('button', { name: 'Run tests' })
}

// The page sits behind RequireRole in the app router, so it only mounts once the stored token is confirmed.
function renderAt(path: string, { onEditorChange }: RenderOptions = {}) {
  setToken('token-7', FUTURE)
  meMock.mockResolvedValue(STUDENT)
  installRunner()
  const router = createMemoryRouter(
    [
      {
        path: '/student/activities/:activityId',
        element: (
          <RequireRole role="STUDENT">
            <WorkspacePage onEditorChange={onEditorChange} />
          </RequireRole>
        ),
      },
      { path: '/student/activities', element: <h1>Activities</h1> },
      { path: '/login', element: <h1>Log in</h1> },
    ],
    { initialEntries: [path] },
  )
  const view = render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
  return { ...view, router }
}

async function renderLoaded(activity: ActivityDetail = ACTIVITY, options: RenderOptions = {}) {
  getActivityMock.mockResolvedValue(activity)
  const view = renderAt(`/student/activities/${activity.id}`, options)
  await screen.findByTestId('monaco-editor')
  // findBy* polls outside act, so the editor can be in the DOM before the effect that warms up runs.
  await waitFor(() => expect(runner.warmUp).toHaveBeenCalled())
  return view
}

afterEach(() => {
  vi.useRealTimers()
  vi.resetAllMocks()
  sessionStorage.clear()
  localStorage.clear()
})

describe('WorkspacePage loading', () => {
  it('shows a loading message until the activity arrives', async () => {
    getActivityMock.mockReturnValue(new Promise<ActivityDetail>(() => {}))
    renderAt('/student/activities/42')

    expect(await screen.findByText('Loading activity…')).toBeInTheDocument()
    expect(screen.queryByTestId('monaco-editor')).not.toBeInTheDocument()
  })

  it('requests the activity in the URL with the signed-in token', async () => {
    await renderLoaded()

    expect(getActivityMock).toHaveBeenCalledWith('token-7', 42, expect.any(AbortSignal))
  })

  it('says the activity is not available, with a link back to Activities, on 404', async () => {
    getActivityMock.mockRejectedValue(notFound())
    const { router } = renderAt('/student/activities/42')

    expect(await screen.findByText("This activity isn't available.")).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Back to Activities' })
    expect(link).toHaveAttribute('href', '/student/activities')
    expect(screen.queryByTestId('monaco-editor')).not.toBeInTheDocument()

    act(() => {
      link.click()
    })
    expect(router.state.location.pathname).toBe('/student/activities')
  })

  it.each(['abc', '0', '-1', '1.5', '01', '99999999999999999999'])(
    'says the activity is not available without a request for the id "%s"',
    async (id) => {
      renderAt(`/student/activities/${id}`)

      expect(await screen.findByText("This activity isn't available.")).toBeInTheDocument()
      expect(getActivityMock).not.toHaveBeenCalled()
    },
  )

  it('shows the server detail for other API errors', async () => {
    getActivityMock.mockRejectedValue(
      new ApiError({ status: 500, title: 'Internal Server Error', detail: 'The server had a problem.', fieldErrors: {} }),
    )
    renderAt('/student/activities/42')

    expect(await screen.findByRole('alert')).toHaveTextContent('The server had a problem.')
    expect(screen.queryByText("This activity isn't available.")).not.toBeInTheDocument()
  })

  it('shows a general message for errors that are not API errors', async () => {
    getActivityMock.mockRejectedValue(new TypeError('boom'))
    renderAt('/student/activities/42')

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
  })

  it('sends the student to the login page when the token is rejected', async () => {
    getActivityMock.mockRejectedValue(
      new ApiError({ status: 401, title: 'Unauthorized', detail: 'Please log in.', fieldErrors: {} }),
    )
    const { router } = renderAt('/student/activities/42')

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('aborts the request when the page unmounts', async () => {
    getActivityMock.mockReturnValue(new Promise<ActivityDetail>(() => {}))
    const view = renderAt('/student/activities/42')
    await screen.findByText('Loading activity…')
    const signal = getActivityMock.mock.lastCall?.[2]

    view.unmount()

    expect(signal?.aborted).toBe(true)
  })
})

describe('WorkspacePage layout', () => {
  it('shows the title, problem panel, editor and results panel together', async () => {
    await renderLoaded()

    expect(screen.getByRole('heading', { level: 1, name: 'Sum of two numbers' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Problem' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Editor' })).toContainElement(screen.getByTestId('monaco-editor'))
    expect(screen.getByRole('region', { name: 'Test results' })).toBeInTheDocument()
  })

  it('shows the problem statement and only the visible tests as examples', async () => {
    await renderLoaded()

    const problem = screen.getByRole('region', { name: 'Problem' })
    expect(
      within(problem).getByText((_, element) => element?.tagName === 'P' && element.textContent === ACTIVITY.problemStatement),
    ).toBeInTheDocument()
    expect(within(problem).getByRole('heading', { name: 'Test 1' })).toBeInTheDocument()
    expect(within(problem).queryByRole('heading', { name: /Test 2/ })).not.toBeInTheDocument()
    expect(within(problem).queryByText('8')).not.toBeInTheDocument()
  })
})

describe('WorkspacePage editor', () => {
  it('starts from the starter code when there is no draft', async () => {
    await renderLoaded()

    expect(lastProps()).toMatchObject({ language: 'python', value: ACTIVITY.starterCode })
  })

  it('starts from the saved draft for this student and activity', async () => {
    localStorage.setItem('epistemictrace:draft:7:42', 'print("draft")')
    await renderLoaded()

    expect(lastProps().value).toBe('print("draft")')
  })

  it('shows what the student typed and saves it under the student and activity', async () => {
    await renderLoaded()
    vi.useFakeTimers()

    type('x = 1', 'x = 1')
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(lastProps().value).toBe('x = 1')
    expect(localStorage.getItem('epistemictrace:draft:7:42')).toBe('x = 1')
  })

  it('keeps drafts for two activities apart', async () => {
    const first = await renderLoaded()
    type('activity 42', 'activity 42')
    first.unmount()

    await renderLoaded({ ...ACTIVITY, id: 43, starterCode: 'starter 43' })
    expect(lastProps().value).toBe('starter 43')

    expect(localStorage.getItem('epistemictrace:draft:7:42')).toBe('activity 42')
  })

  it('passes each editor change to onEditorChange for telemetry', async () => {
    const onEditorChange = vi.fn()
    await renderLoaded(ACTIVITY, { onEditorChange })

    type('ab', 'b')
    type('a', '', 1)

    expect(onEditorChange).toHaveBeenCalledTimes(2)
    expect(onEditorChange).toHaveBeenNthCalledWith(1, 'ab', expect.objectContaining({ charsAdded: 1, charsRemoved: 0 }))
    expect(onEditorChange).toHaveBeenNthCalledWith(2, 'a', expect.objectContaining({ charsAdded: 0, charsRemoved: 1 }))
  })

  it('still works when localStorage throws', async () => {
    const denied = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    }
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    await renderLoaded()
    getItem.mockImplementation(denied)
    setItem.mockImplementation(denied)

    type('x = 1', 'x = 1')
    window.dispatchEvent(new Event('pagehide'))

    expect(lastProps().value).toBe('x = 1')
    getItem.mockRestore()
    setItem.mockRestore()
  })
})

describe('WorkspacePage runner', () => {
  it('warms up one runner when the activity has loaded, and shows Preparing Python… until then', async () => {
    await renderLoaded()

    expect(createRunnerMock).toHaveBeenCalledTimes(1)
    expect(runner.warmUp).toHaveBeenCalledTimes(1)
    const button = screen.getByRole('button', { name: 'Preparing Python…' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-disabled', 'true')
  })

  it('does not start Python while the activity is loading or not available', async () => {
    getActivityMock.mockRejectedValue(notFound())
    renderAt('/student/activities/42')
    await screen.findByText("This activity isn't available.")

    expect(runner.warmUp).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /Run tests|Preparing Python/ })).not.toBeInTheDocument()
  })

  it('enables Run tests once Python is ready', async () => {
    await renderLoaded()

    await warmUpDone()

    expect(screen.getByRole('button', { name: 'Run tests' })).toBeEnabled()
  })

  it('says Python could not start when warm-up fails, and keeps the button disabled', async () => {
    await renderLoaded()

    await act(async () => finishWarmUp.reject(new Error('CDN unreachable')))

    expect(screen.getByRole('alert')).toHaveTextContent("Python couldn't start. Refresh the page to try again.")
    expect(screen.getByRole('button', { name: 'Run tests' })).toBeDisabled()
  })

  it('runs the current code against every test case, hidden ones included', async () => {
    await renderLoaded()
    await warmUpDone()
    type('print(7)', 'print(7)')

    await runTestsAndWait()

    expect(runner.run.mock.calls).toEqual([
      ['print(7)', '3\n4'],
      ['print(7)', '10\n-2'],
    ])
  })

  it('shows Running… and disables the button during a run, and keeps the editor editable', async () => {
    await renderLoaded()
    await warmUpDone()
    let finish: (result: ExecutionResult) => void = () => {}
    runner.run.mockReturnValueOnce(new Promise<ExecutionResult>((resolve) => (finish = resolve)))

    fireEvent.click(screen.getByRole('button', { name: 'Run tests' }))

    const button = screen.getByRole('button', { name: 'Running…' })
    expect(button).toBeDisabled()
    expect(lastProps().options?.readOnly).not.toBe(true)
    type('edited while running', 'edited while running')
    expect(lastProps().value).toBe('edited while running')

    await act(async () => finish({ status: 'ok', stdout: '7' }))

    expect(screen.getByRole('button', { name: 'Run tests' })).toBeEnabled()
  })

  it('runs again after a timeout', async () => {
    await renderLoaded()
    await warmUpDone()
    runner.run.mockResolvedValueOnce({ status: 'timeout' })

    await runTestsAndWait()
    expect(runner.run).toHaveBeenCalledTimes(1)

    await runTestsAndWait()
    expect(runner.run).toHaveBeenCalledTimes(3)
  })

  it('disposes the runner when the page unmounts', async () => {
    const view = await renderLoaded()
    expect(runner.dispose).not.toHaveBeenCalled()

    view.unmount()

    expect(runner.dispose).toHaveBeenCalledTimes(1)
  })
})

describe('WorkspacePage results', () => {
  it('shows the placeholder before the first run', async () => {
    await renderLoaded()

    const results = screen.getByRole('region', { name: 'Test results' })
    expect(within(results).getByText('Run your code to see test results here.')).toBeInTheDocument()
  })

  it('updates the results panel after each run', async () => {
    await renderLoaded()
    await warmUpDone()
    runner.run.mockResolvedValueOnce({ status: 'ok', stdout: '7\n' }).mockResolvedValueOnce({ status: 'ok', stdout: '0\n' })

    await runTestsAndWait()
    const results = screen.getByRole('region', { name: 'Test results' })
    expect(within(results).getByText('1 of 2 tests passed')).toBeInTheDocument()

    runner.run.mockResolvedValueOnce({ status: 'ok', stdout: '7\n' }).mockResolvedValueOnce({ status: 'ok', stdout: '8\n' })
    await runTestsAndWait()
    expect(within(results).getByText('2 of 2 tests passed')).toBeInTheDocument()
    expect(within(results).queryByText('1 of 2 tests passed')).not.toBeInTheDocument()
  })

  it('shows a visible failure in full and a hidden failure as name and status only', async () => {
    await renderLoaded()
    await warmUpDone()
    runner.run
      .mockResolvedValueOnce({ status: 'ok', stdout: 'six\n' })
      .mockResolvedValueOnce({ status: 'ok', stdout: 'hidden actual\n' })

    await runTestsAndWait()

    const results = screen.getByRole('region', { name: 'Test results' })
    expect(within(results).getByText('0 of 2 tests passed')).toBeInTheDocument()
    expect(within(results).getByText('Test 1')).toBeInTheDocument()
    expect(within(results).getByText((_, element) => element?.tagName === 'PRE' && element.textContent === 'six\n')).toBeInTheDocument()
    expect(within(results).getByText('Hidden test 2')).toBeInTheDocument()
    expect(within(results).queryByText(/hidden actual/)).not.toBeInTheDocument()
    expect(within(results).queryByText('10\n-2')).not.toBeInTheDocument()
  })

  it('shows a runtime error with its type, line and message', async () => {
    await renderLoaded()
    await warmUpDone()
    runner.run.mockResolvedValue({
      status: 'error',
      stdout: '',
      error: { type: 'ZeroDivisionError', message: 'division by zero', line: 2 },
    })

    await runTestsAndWait()

    expect(screen.getByText('ZeroDivisionError on line 2')).toBeInTheDocument()
    expect(screen.getByText('division by zero')).toBeInTheDocument()
  })

  it('shows the timeout message, and the next run replaces it', async () => {
    await renderLoaded()
    await warmUpDone()
    runner.run.mockResolvedValueOnce({ status: 'timeout' })

    await runTestsAndWait()
    expect(screen.getByText(/Your code ran longer than 3 seconds and was stopped\./)).toBeInTheDocument()

    await runTestsAndWait()
    expect(screen.queryByText(/Your code ran longer than/)).not.toBeInTheDocument()
    expect(screen.getByText('1 of 2 tests passed')).toBeInTheDocument()
  })
})
