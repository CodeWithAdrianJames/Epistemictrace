import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/ApiError.ts'
import { me, type User } from '../api/authApi.ts'
import { AuthProvider, useAuth } from './AuthProvider.tsx'
import { getToken, setToken } from './tokenStore.ts'
import { useProtectedRequest } from './useProtectedRequest.ts'

vi.mock('../api/authApi.ts', () => ({
  register: vi.fn(),
  login: vi.fn(),
  me: vi.fn(),
}))

const meMock = vi.mocked(me)

const FUTURE = '2099-01-01T00:00:00Z'

const STUDENT: User = {
  id: 7,
  name: 'Student One',
  email: 'student1@example.test',
  role: 'STUDENT',
  consentAccepted: false,
}

function apiError(status: number): ApiError {
  return new ApiError({ status, title: `HTTP ${status}`, detail: `detail ${status}`, fieldErrors: {} })
}

// Stands in for a page that loads data through an api/ module taking the token as an argument.
function Caller({ call }: { call: (token: string) => Promise<string> }) {
  const { status } = useAuth()
  const request = useProtectedRequest()
  const [result, setResult] = useState('idle')

  function handleClick() {
    request(call).then(
      (value) => setResult(`ok:${value}`),
      (error: unknown) => setResult(error instanceof ApiError ? `error:${error.status}` : `thrown:${String(error)}`),
    )
  }

  return (
    <>
      <button type="button" onClick={handleClick}>
        Load
      </button>
      <p>{result}</p>
      <p>status:{status}</p>
    </>
  )
}

function renderCaller(call: (token: string) => Promise<string>, signedIn = true) {
  if (signedIn) {
    setToken('token-7', FUTURE)
    meMock.mockResolvedValue(STUDENT)
  }
  const router = createMemoryRouter(
    [
      { path: '/page', element: <Caller call={call} /> },
      { path: '/login', element: <h1>Login stub</h1> },
    ],
    { initialEntries: ['/page'] },
  )
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
  return router
}

async function clickLoadWhenSignedIn() {
  await screen.findByText('status:authenticated')
  fireEvent.click(screen.getByRole('button', { name: 'Load' }))
}

afterEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
})

describe('useProtectedRequest', () => {
  it("passes the provider's token to the call and returns its result", async () => {
    const call = vi.fn().mockResolvedValue('data')
    const router = renderCaller(call)

    await clickLoadWhenSignedIn()

    expect(await screen.findByText('ok:data')).toBeInTheDocument()
    expect(call).toHaveBeenCalledExactlyOnceWith('token-7')
    expect(router.state.location.pathname).toBe('/page')
    expect(getToken()).toBe('token-7')
  })

  it('logs out and redirects to /login on 401, then rethrows', async () => {
    const call = vi.fn().mockRejectedValue(apiError(401))
    const router = renderCaller(call)

    await clickLoadWhenSignedIn()

    expect(await screen.findByRole('heading', { level: 1, name: 'Login stub' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.historyAction).toBe('REPLACE')
    expect(getToken()).toBeNull()
  })

  it('logs out on 401 when the token has expired in the tab meanwhile', async () => {
    const call = vi.fn().mockImplementation(async () => {
      sessionStorage.clear()
      throw apiError(401)
    })
    const router = renderCaller(call)

    await clickLoadWhenSignedIn()

    expect(await screen.findByRole('heading', { level: 1, name: 'Login stub' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it.each([0, 403, 404, 500])('rethrows a %s error without logging out', async (status) => {
    const call = vi.fn().mockRejectedValue(apiError(status))
    const router = renderCaller(call)

    await clickLoadWhenSignedIn()

    expect(await screen.findByText(`error:${status}`)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/page')
    expect(getToken()).toBe('token-7')
  })

  it('does not log out a newer session when a 401 arrives for a replaced token', async () => {
    const call = vi.fn().mockImplementation(async () => {
      setToken('token-new', FUTURE)
      throw apiError(401)
    })
    const router = renderCaller(call)

    await clickLoadWhenSignedIn()

    expect(await screen.findByText('error:401')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/page')
    expect(getToken()).toBe('token-new')
  })

  it('rejects without calling the API when nobody is signed in', async () => {
    const call = vi.fn().mockResolvedValue('data')
    renderCaller(call, false)

    fireEvent.click(screen.getByRole('button', { name: 'Load' }))

    expect(await screen.findByText('thrown:Error: useProtectedRequest needs a signed-in user')).toBeInTheDocument()
    expect(call).not.toHaveBeenCalled()
  })
})
