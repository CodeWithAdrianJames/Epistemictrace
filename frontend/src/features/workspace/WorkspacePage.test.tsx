import Editor, { type EditorProps, type OnChange } from '@monaco-editor/react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { me, type User } from '../../api/authApi.ts'
import RequireRole from '../../app/RequireRole.tsx'
import { AuthProvider } from '../../auth/AuthProvider.tsx'
import { setToken } from '../../auth/tokenStore.ts'
import { createPythonRunner, type ExecutionResult, type PythonRunner } from '../runner/pythonRunner.ts'
import WorkspacePage from './WorkspacePage.tsx'

vi.mock('../../api/authApi.ts', () => ({
  register: vi.fn(),
  login: vi.fn(),
  me: vi.fn(),
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

// The page sits behind RequireRole in the app router, so it only mounts once the stored token is confirmed.
let runner: { [K in keyof PythonRunner]: ReturnType<typeof vi.fn<PythonRunner[K]>> }

function renderAt(path: string) {
  setToken('token-7', FUTURE)
  meMock.mockResolvedValue(STUDENT)
  runner = { warmUp: vi.fn(async () => {}), run: vi.fn(async () => ({ status: 'ok', stdout: '' })), dispose: vi.fn() }
  createRunnerMock.mockReturnValue(runner)
  const router = createMemoryRouter(
    [
      {
        path: '/student/activities/:activityId',
        element: (
          <RequireRole role="STUDENT">
            <WorkspacePage />
          </RequireRole>
        ),
      },
    ],
    { initialEntries: [path] },
  )
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
}

afterEach(() => {
  vi.useRealTimers()
  vi.resetAllMocks()
  sessionStorage.clear()
  localStorage.clear()
})

describe('WorkspacePage (temporary editor mount)', () => {
  it('shows the heading and a Python editor with an empty starter', async () => {
    renderAt('/student/activities/42')

    expect(await screen.findByRole('heading', { level: 1, name: 'Activity workspace' })).toBeInTheDocument()
    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument()
    expect(lastProps()).toMatchObject({ language: 'python', value: '' })
  })

  it('shows what the student typed as the editor value', async () => {
    renderAt('/student/activities/42')
    await screen.findByTestId('monaco-editor')

    type('x', 'x')
    type('x = 1', ' = 1')

    expect(lastProps().value).toBe('x = 1')
  })

  it('saves the code under the logged-in user and the activity in the URL', async () => {
    renderAt('/student/activities/42')
    await screen.findByTestId('monaco-editor')
    vi.useFakeTimers()

    type('print("hi")', 'print("hi")')
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(localStorage.getItem('epistemictrace:draft:7:42')).toBe('print("hi")')
  })

  it('shows the saved code again after the page is reloaded', async () => {
    const first = renderAt('/student/activities/42')
    await screen.findByTestId('monaco-editor')
    type('x = 1', 'x = 1')
    first.unmount()

    renderAt('/student/activities/42')
    await screen.findByTestId('monaco-editor')

    expect(lastProps().value).toBe('x = 1')
  })

  it('keeps drafts for two activities apart', async () => {
    const first = renderAt('/student/activities/42')
    await screen.findByTestId('monaco-editor')
    type('activity 42', 'activity 42')
    first.unmount()

    const second = renderAt('/student/activities/43')
    await screen.findByTestId('monaco-editor')
    expect(lastProps().value).toBe('')
    type('activity 43', 'activity 43')
    second.unmount()

    expect(localStorage.getItem('epistemictrace:draft:7:42')).toBe('activity 42')
    expect(localStorage.getItem('epistemictrace:draft:7:43')).toBe('activity 43')
  })

  it('still works when localStorage throws', async () => {
    const denied = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    }
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    renderAt('/student/activities/42')
    await screen.findByTestId('monaco-editor')
    getItem.mockImplementation(denied)
    setItem.mockImplementation(denied)

    type('x = 1', 'x = 1')
    window.dispatchEvent(new Event('pagehide'))

    expect(lastProps().value).toBe('x = 1')
    getItem.mockRestore()
    setItem.mockRestore()
  })
})

describe('WorkspacePage (temporary runner check)', () => {
  it('does not create a worker until a button is used', async () => {
    renderAt('/student/activities/42')
    await screen.findByTestId('monaco-editor')

    expect(screen.getByRole('region', { name: 'Runner check (temporary)' })).toBeInTheDocument()
    expect(runner.warmUp).not.toHaveBeenCalled()
    expect(runner.run).not.toHaveBeenCalled()
  })

  it('runs the hard-coded double-the-input program with stdin 21 and shows the result and time', async () => {
    renderAt('/student/activities/42')
    await screen.findByTestId('monaco-editor')
    const result: ExecutionResult = { status: 'ok', stdout: '42\n' }
    runner.run.mockResolvedValue(result)

    fireEvent.click(screen.getByRole('button', { name: 'Double the input' }))

    expect(runner.run).toHaveBeenCalledWith('print(int(input()) * 2)', '21')
    expect(await screen.findByText(/Double the input \(\d+ ms\): \{"status":"ok","stdout":"42\\n"\}/)).toBeInTheDocument()
  })

  it.each([
    ['Infinite loop', 'while True:\n    pass', ''],
    ['Divide by zero', 'x = 1\n1/0', ''],
    ['Define x', 'x = 5\nprint(x)', ''],
    ['Print x', 'print(x)', ''],
    ['Read past the end', 'input()\ninput()', 'one line'],
  ])('has a %s button that runs its hard-coded program', async (label, code, stdin) => {
    renderAt('/student/activities/42')
    await screen.findByTestId('monaco-editor')

    fireEvent.click(screen.getByRole('button', { name: label }))

    expect(runner.run).toHaveBeenCalledWith(code, stdin)
  })

  it('shows the start-up time for Warm up', async () => {
    renderAt('/student/activities/42')
    await screen.findByTestId('monaco-editor')

    fireEvent.click(screen.getByRole('button', { name: 'Warm up' }))

    expect(await screen.findByText(/Warm up \(\d+ ms\): "ready"/)).toBeInTheDocument()
    expect(runner.warmUp).toHaveBeenCalledTimes(1)
  })

  it('disables the buttons while a run is in progress and enables them again afterwards', async () => {
    renderAt('/student/activities/42')
    await screen.findByTestId('monaco-editor')
    let finish: (result: ExecutionResult) => void = () => {}
    runner.run.mockReturnValue(new Promise<ExecutionResult>((resolve) => (finish = resolve)))

    fireEvent.click(screen.getByRole('button', { name: 'Infinite loop' }))

    expect(screen.getByRole('button', { name: 'Double the input' })).toBeDisabled()
    expect(screen.getByText('Infinite loop: running…')).toBeInTheDocument()

    await act(async () => finish({ status: 'timeout' }))

    expect(screen.getByRole('button', { name: 'Double the input' })).toBeEnabled()
    expect(screen.getByText(/Infinite loop \(\d+ ms\): \{"status":"timeout"\}/)).toBeInTheDocument()
  })

  it('shows the error message when the runner rejects', async () => {
    renderAt('/student/activities/42')
    await screen.findByTestId('monaco-editor')
    runner.run.mockRejectedValue(new Error('busy'))

    fireEvent.click(screen.getByRole('button', { name: 'Define x' }))

    expect(await screen.findByText('Define x: busy')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Define x' })).toBeEnabled()
  })

  it('disposes the runner when the page unmounts', async () => {
    const view = renderAt('/student/activities/42')
    await screen.findByTestId('monaco-editor')
    expect(runner.dispose).not.toHaveBeenCalled()

    view.unmount()

    expect(runner.dispose).toHaveBeenCalled()
  })
})
