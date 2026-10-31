import Editor, { type EditorProps, type OnChange } from '@monaco-editor/react'
import { act, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { me, type User } from '../../api/authApi.ts'
import RequireRole from '../../app/RequireRole.tsx'
import { AuthProvider } from '../../auth/AuthProvider.tsx'
import { setToken } from '../../auth/tokenStore.ts'
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
function renderAt(path: string) {
  setToken('token-7', FUTURE)
  meMock.mockResolvedValue(STUDENT)
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
