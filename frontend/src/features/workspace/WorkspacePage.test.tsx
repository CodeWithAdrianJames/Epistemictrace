import Editor, { type EditorProps, type OnChange } from '@monaco-editor/react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getActivity, type ActivityDetail } from '../../api/activitiesApi.ts'
import { ApiError } from '../../api/ApiError.ts'
import { me, type User } from '../../api/authApi.ts'
import { putConsent } from '../../api/consentApi.ts'
import { endSession, sendEvents, startSession, submitReflection } from '../../api/sessionsApi.ts'
import RequireRole from '../../app/RequireRole.tsx'
import { AuthProvider } from '../../auth/AuthProvider.tsx'
import { setToken } from '../../auth/tokenStore.ts'
import { CONSENT_DECLINED_KEY } from '../consent/useConsent.ts'
import type { BatchResponse, SessionStart } from '../../api/sessionsApi.ts'
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

vi.mock('../../api/consentApi.ts', () => ({
  putConsent: vi.fn(),
}))

// Only the requests are mocked; parseBreaker stays real so the page validates breaker payloads as in production.
vi.mock('../../api/sessionsApi.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/sessionsApi.ts')>()),
  startSession: vi.fn(),
  endSession: vi.fn(),
  sendEvents: vi.fn(),
  submitReflection: vi.fn(),
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
const putConsentMock = vi.mocked(putConsent)
const startSessionMock = vi.mocked(startSession)
const endSessionMock = vi.mocked(endSession)
const sendEventsMock = vi.mocked(sendEvents)
const submitReflectionMock = vi.mocked(submitReflection)
const EditorMock = vi.mocked(Editor)

type ContentChangedEvent = Parameters<OnChange>[1]

const FUTURE = '2099-01-01T00:00:00Z'

const STUDENT: User = {
  id: 7,
  name: 'Student One',
  email: 'student1@example.test',
  role: 'STUDENT',
  consentAccepted: true,
}

const NEW_STUDENT: User = { ...STUDENT, consentAccepted: false }

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
  // The signed-in student; defaults to one who already accepted, so the consent notice stays out of the way.
  user?: User
  // The POST /api/sessions answer; defaults to a new, unlocked session without a breaker.
  start?: SessionStart
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
function renderAt(path: string, { onEditorChange, user = STUDENT, start }: RenderOptions = {}) {
  setToken('token-7', FUTURE)
  meMock.mockResolvedValue(user)
  installRunner()
  startSessionMock.mockResolvedValue(start ?? { sessionId: 5, activityId: 42, startedAt: '2026-11-03T02:00:00Z', resumed: false })
  endSessionMock.mockResolvedValue(undefined)
  sendEventsMock.mockResolvedValue({ accepted: 1, duplicates: 0 })
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
    // The loading text can render before the effect that requests the activity has run.
    await waitFor(() => expect(getActivityMock).toHaveBeenCalled())
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

describe('WorkspacePage consent notice', () => {
  const BANNER_TEXT = "Tracking is off for this visit, so tests won't pause and nothing is recorded."

  it('shows the notice once the activity has loaded for a student who has not accepted', async () => {
    await renderLoaded(ACTIVITY, { user: NEW_STUDENT })

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'I agree' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument()
    // The page behind the dialog is still rendered.
    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Problem' })).toBeInTheDocument()
  })

  it('does not show the notice while the activity is loading', async () => {
    getActivityMock.mockReturnValue(new Promise<ActivityDetail>(() => {}))
    renderAt('/student/activities/42', { user: NEW_STUDENT })

    await screen.findByText('Loading activity…')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not show the notice when the activity is not available', async () => {
    getActivityMock.mockRejectedValue(notFound())
    renderAt('/student/activities/42', { user: NEW_STUDENT })

    await screen.findByText("This activity isn't available.")

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not show the notice or the banner for a student who already accepted', async () => {
    await renderLoaded()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument()
  })

  it('closes the notice after I agree and records the consent', async () => {
    putConsentMock.mockResolvedValue({ consentAcceptedAt: '2026-10-31T08:00:00Z' })
    await renderLoaded(ACTIVITY, { user: NEW_STUDENT })

    fireEvent.click(screen.getByRole('button', { name: 'I agree' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(putConsentMock).toHaveBeenCalledWith('token-7')
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument()
  })

  it('shows the banner above the regions after Not now, and the student can still run tests', async () => {
    await renderLoaded(ACTIVITY, { user: NEW_STUDENT })

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent(BANNER_TEXT)
    expect(banner.compareDocumentPosition(screen.getByRole('region', { name: 'Editor' }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    await warmUpDone()
    await runTestsAndWait()
    expect(runner.run).toHaveBeenCalledTimes(2)
    expect(putConsentMock).not.toHaveBeenCalled()
  })

  it('shows the banner and no dialog when this tab declined earlier', async () => {
    sessionStorage.setItem(CONSENT_DECLINED_KEY, 'true')

    await renderLoaded(ACTIVITY, { user: NEW_STUDENT })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(BANNER_TEXT)
  })

  it('reopens the notice from Turn on tracking', async () => {
    sessionStorage.setItem(CONSENT_DECLINED_KEY, 'true')
    await renderLoaded(ACTIVITY, { user: NEW_STUDENT })

    fireEvent.click(screen.getByRole('button', { name: 'Turn on tracking' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows the notice again in a new tab (empty sessionStorage) after a decline', async () => {
    const first = await renderLoaded(ACTIVITY, { user: NEW_STUDENT })
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    first.unmount()
    sessionStorage.removeItem(CONSENT_DECLINED_KEY)

    await renderLoaded(ACTIVITY, { user: NEW_STUDENT })

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('WorkspacePage telemetry', () => {
  it('starts a session for the activity and sends the last edit, then RUN, after a run', async () => {
    await renderLoaded()
    await waitFor(() => expect(startSessionMock).toHaveBeenCalledWith('token-7', 42, expect.any(AbortSignal)))
    await warmUpDone()

    type('a = 1', 'a = 1')
    await runTestsAndWait()

    await waitFor(() => expect(sendEventsMock).toHaveBeenCalled())
    const [token, sessionId, events] = sendEventsMock.mock.calls[0]
    expect([token, sessionId]).toEqual(['token-7', 5])
    expect(events.map((event) => event.type)).toEqual(['EDIT', 'RUN'])
    expect(events[1]).toMatchObject({ type: 'RUN', passedCount: 1, totalCount: 2 })
  })

  it('never starts a session while consent is not accepted', async () => {
    await renderLoaded(ACTIVITY, { user: NEW_STUDENT })
    await warmUpDone()

    type('a = 1', 'a = 1')
    await runTestsAndWait()

    expect(startSessionMock).not.toHaveBeenCalled()
    expect(sendEventsMock).not.toHaveBeenCalled()
  })

  it('shows a small notice and keeps the page usable when the session cannot start', async () => {
    getActivityMock.mockResolvedValue(ACTIVITY)
    renderAt('/student/activities/42')
    // renderAt installs a resolving start; the session starts only after the activity loads.
    startSessionMock.mockRejectedValue(new ApiError({ status: 0, title: 'Network error', detail: 'x', fieldErrors: {} }))

    expect(await screen.findByText('Tracking is unavailable right now.')).toBeInTheDocument()
    await waitFor(() => expect(runner.warmUp).toHaveBeenCalled())
    await warmUpDone()
    await runTestsAndWait()
    expect(sendEventsMock).not.toHaveBeenCalled()
  })

  it('ends the session with keepalive when the student leaves the page', async () => {
    const { unmount } = await renderLoaded()
    await waitFor(() => expect(startSessionMock).toHaveBeenCalled())
    await act(async () => {})

    unmount()

    await waitFor(() => expect(endSessionMock).toHaveBeenCalledWith('token-7', 5, { keepalive: true }))
  })
})

describe('WorkspacePage breaker', () => {
  const LOCKED = { state: 'LOCKED', cooldownEndsAt: null, reflectionMinLength: 20 }
  const START = { sessionId: 5, activityId: 42, startedAt: '2026-11-03T02:00:00Z', resumed: true }

  it('a resumed locked session shows the paused panel and keeps the editor usable', async () => {
    await renderLoaded(ACTIVITY, { start: { ...START, breaker: LOCKED } })
    await screen.findByRole('heading', { name: "Let's pause and plan" })
    await warmUpDone()

    const button = screen.getByRole('button', { name: 'Paused — see below' })
    expect(button).toBeDisabled()
    expect(screen.getByRole('heading', { name: "Let's pause and plan" })).toHaveFocus()

    type('b = 2', 'b = 2')
    expect(lastProps().value).toBe('b = 2')
  })

  it('a batch response that locks disables Run tests after the run', async () => {
    await renderLoaded()
    sendEventsMock.mockResolvedValue({ accepted: 1, duplicates: 0, breaker: LOCKED })
    await waitFor(() => expect(startSessionMock).toHaveBeenCalled())
    await warmUpDone()

    fireEvent.click(screen.getByRole('button', { name: 'Run tests' }))

    expect(await screen.findByRole('button', { name: 'Paused — see below' })).toBeDisabled()
    expect(screen.getByRole('heading', { name: "Let's pause and plan" })).toBeInTheDocument()
    expect(screen.queryByText(/SDI/)).not.toBeInTheDocument()
  })

  it('keeps Run tests disabled as Running… until the server answers the run', async () => {
    let answer: (response: BatchResponse) => void = () => undefined
    await renderLoaded()
    sendEventsMock.mockReturnValue(
      new Promise<BatchResponse>((resolve) => {
        answer = resolve
      }),
    )
    await waitFor(() => expect(startSessionMock).toHaveBeenCalled())
    await act(async () => {})
    await warmUpDone()

    fireEvent.click(screen.getByRole('button', { name: 'Run tests' }))
    await waitFor(() => expect(sendEventsMock).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'Running…' })).toBeDisabled()

    await act(async () => answer({ accepted: 1, duplicates: 0 }))
    expect(screen.getByRole('button', { name: 'Run tests' })).toBeEnabled()
    expect(screen.queryByText(/couldn't reach the server/)).not.toBeInTheDocument()
  })

  it('fails open with a notice when sending the run fails', async () => {
    await renderLoaded()
    sendEventsMock.mockRejectedValue(new ApiError({ status: 0, title: 'Network error', detail: 'x', fieldErrors: {} }))
    await waitFor(() => expect(startSessionMock).toHaveBeenCalled())
    await act(async () => {})
    await warmUpDone()

    fireEvent.click(screen.getByRole('button', { name: 'Run tests' }))

    expect(
      await screen.findByText("We couldn't reach the server. Your tests still run, but pauses may not work right now."),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run tests' })).toBeEnabled()
  })

  it('during cooldown shows the top-bar notice and Run tests works', async () => {
    await renderLoaded(ACTIVITY, {
      start: { ...START, breaker: { state: 'COOLDOWN', cooldownEndsAt: '2099-01-01T00:00:00Z', reflectionMinLength: 20 } },
    })
    expect(await screen.findByText('Tests are running again. Keep going step by step.')).toBeInTheDocument()
    await warmUpDone()

    await runTestsAndWait()
    expect(runner.run).toHaveBeenCalled()
  })
})

describe('WorkspacePage reflection', () => {
  const START = {
    sessionId: 5,
    activityId: 42,
    startedAt: '2026-11-03T02:00:00Z',
    resumed: true,
    breaker: { state: 'LOCKED', cooldownEndsAt: null, reflectionMinLength: 20 },
  }

  it('a reflection unlocks the runner into cooldown and moves focus back to Run tests', async () => {
    submitReflectionMock.mockResolvedValue({
      reflectionId: 3,
      submittedAt: '2026-11-03T02:30:00Z',
      breaker: { state: 'COOLDOWN', cooldownEndsAt: '2099-01-01T00:00:00Z', reflectionMinLength: 20 },
    })
    await renderLoaded(ACTIVITY, { start: START })
    await screen.findByRole('heading', { name: "Let's pause and plan" })
    await warmUpDone()
    expect(screen.getAllByText('0 / 20 characters')).toHaveLength(2)

    // The editor keeps working while the form is open.
    type('c = 3', 'c = 3')
    expect(lastProps().value).toBe('c = 3')
    fireEvent.change(screen.getByLabelText('What do you think is wrong?'), { target: { value: 'The loop never stops at n.' } })
    fireEvent.change(screen.getByLabelText('What will you try next?'), { target: { value: 'Print i before the check.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    const runButton = await screen.findByRole('button', { name: 'Run tests' })
    expect(submitReflectionMock).toHaveBeenCalledWith('token-7', 5, {
      hypothesis: 'The loop never stops at n.',
      plannedFix: 'Print i before the check.',
    })
    expect(screen.queryByRole('heading', { name: "Let's pause and plan" })).not.toBeInTheDocument()
    expect(screen.getByText('Tests are running again. Keep going step by step.')).toBeInTheDocument()
    expect(runButton).toBeEnabled()
    await waitFor(() => expect(runButton).toHaveFocus())
  })

  it('a 409 closes the panel and re-enables Run tests', async () => {
    submitReflectionMock.mockRejectedValue(
      new ApiError({ status: 409, title: 'Conflict', detail: "Tests aren't paused right now.", fieldErrors: {} }),
    )
    await renderLoaded(ACTIVITY, { start: START })
    await screen.findByRole('heading', { name: "Let's pause and plan" })
    await warmUpDone()

    fireEvent.change(screen.getByLabelText('What do you think is wrong?'), { target: { value: 'The loop never stops at n.' } })
    fireEvent.change(screen.getByLabelText('What will you try next?'), { target: { value: 'Print i before the check.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByRole('button', { name: 'Run tests' })).toBeEnabled()
    expect(screen.queryByRole('heading', { name: "Let's pause and plan" })).not.toBeInTheDocument()
  })
})
