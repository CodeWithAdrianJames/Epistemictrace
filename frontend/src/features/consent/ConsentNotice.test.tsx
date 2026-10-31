import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/ApiError.ts'
import { me, type User } from '../../api/authApi.ts'
import { putConsent } from '../../api/consentApi.ts'
import { AuthProvider, useAuth } from '../../auth/AuthProvider.tsx'
import { setToken } from '../../auth/tokenStore.ts'
import ConsentNotice from './ConsentNotice.tsx'
import { CONSENT_PARAGRAPHS, CONSENT_TITLE } from './consentText.ts'
import { CONSENT_DECLINED_KEY, useConsent } from './useConsent.ts'

vi.mock('../../api/authApi.ts', () => ({
  register: vi.fn(),
  login: vi.fn(),
  me: vi.fn(),
}))

vi.mock('../../api/consentApi.ts', () => ({
  putConsent: vi.fn(),
}))

const meMock = vi.mocked(me)
const putConsentMock = vi.mocked(putConsent)

const FUTURE = '2099-01-01T00:00:00Z'
const BANNER_TEXT = "Tracking is off for this visit, so tests won't pause and nothing is recorded."

const NEW_STUDENT: User = {
  id: 7,
  name: 'Student One',
  email: 'student1@example.test',
  role: 'STUDENT',
  consentAccepted: false,
}

// The notice gets its consent from the real hook, the way the workspace page wires it.
function Harness() {
  const consent = useConsent()
  const { user } = useAuth()
  return (
    <>
      <p>{`status:${consent.status}`}</p>
      <p>{`consentAccepted:${String(user?.consentAccepted)}`}</p>
      <button type="button">Run tests</button>
      <ConsentNotice consent={consent} />
    </>
  )
}

async function renderNotice(user: User = NEW_STUDENT) {
  setToken('token-7', FUTURE)
  meMock.mockResolvedValue(user)
  const view = render(
    <MemoryRouter>
      <AuthProvider>
        <AuthenticatedOnly>
          <Harness />
        </AuthenticatedOnly>
      </AuthProvider>
    </MemoryRouter>,
  )
  await screen.findByText(/^status:/)
  return view
}

function AuthenticatedOnly({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  return status === 'authenticated' ? children : null
}

function apiError(status: number, detail: string): ApiError {
  return new ApiError({ status, title: `HTTP ${status}`, detail, fieldErrors: {} })
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
  let resolve: (value: T) => void = () => {}
  let reject: (error: unknown) => void = () => {}
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

afterEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
})

describe('ConsentNotice when the choice is pending', () => {
  it('shows a modal dialog with the notice text and the I agree and Not now actions', async () => {
    await renderNotice()

    const dialog = screen.getByRole('dialog', { name: CONSENT_TITLE })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    for (const paragraph of CONSENT_PARAGRAPHS) {
      expect(dialog).toHaveTextContent(paragraph)
    }
    expect(screen.getByRole('button', { name: 'I agree' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Not now' })).toBeEnabled()
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument()
  })

  it('moves focus into the dialog', async () => {
    await renderNotice()

    expect(screen.getByRole('dialog')).toHaveFocus()
  })

  it('keeps Tab and Shift+Tab inside the dialog', async () => {
    await renderNotice()
    const dialog = screen.getByRole('dialog')
    const agree = screen.getByRole('button', { name: 'I agree' })
    const notNow = screen.getByRole('button', { name: 'Not now' })

    // Tab from the last action wraps to the first; Shift+Tab from the first (or the dialog) wraps to the last.
    notNow.focus()
    expect(fireEvent.keyDown(notNow, { key: 'Tab' })).toBe(false)
    expect(agree).toHaveFocus()

    expect(fireEvent.keyDown(agree, { key: 'Tab', shiftKey: true })).toBe(false)
    expect(notNow).toHaveFocus()

    dialog.focus()
    expect(fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })).toBe(false)
    expect(notNow).toHaveFocus()
  })

  it('lets Tab move normally between the actions', async () => {
    await renderNotice()
    const agree = screen.getByRole('button', { name: 'I agree' })
    const notNow = screen.getByRole('button', { name: 'Not now' })

    agree.focus()
    expect(fireEvent.keyDown(agree, { key: 'Tab' })).toBe(true)
    notNow.focus()
    expect(fireEvent.keyDown(notNow, { key: 'Tab', shiftKey: true })).toBe(true)
  })

  it('does not show for an account that already accepted', async () => {
    await renderNotice({ ...NEW_STUDENT, consentAccepted: true })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument()
  })
})

describe('ConsentNotice I agree', () => {
  it('calls the API, then closes and records the acceptance on the auth user', async () => {
    putConsentMock.mockResolvedValue({ consentAcceptedAt: '2026-10-31T08:00:00Z' })
    await renderNotice()

    fireEvent.click(screen.getByRole('button', { name: 'I agree' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(putConsentMock).toHaveBeenCalledTimes(1)
    expect(putConsentMock.mock.calls[0][0]).toBe('token-7')
    expect(screen.getByText('status:accepted')).toBeInTheDocument()
    expect(screen.getByText('consentAccepted:true')).toBeInTheDocument()
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument()
  })

  it('disables both actions while the request is pending', async () => {
    const pending = deferred<{ consentAcceptedAt: string }>()
    putConsentMock.mockReturnValue(pending.promise)
    await renderNotice()

    fireEvent.click(screen.getByRole('button', { name: 'I agree' }))

    expect(screen.getByRole('button', { name: 'I agree' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Not now' })).toBeDisabled()
    pending.resolve({ consentAcceptedAt: '2026-10-31T08:00:00Z' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows the server detail in the dialog and keeps it open when the request fails', async () => {
    putConsentMock.mockRejectedValue(apiError(500, 'The server had a problem.'))
    await renderNotice()

    fireEvent.click(screen.getByRole('button', { name: 'I agree' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The server had a problem.')
    expect(screen.getByRole('dialog')).toContainElement(screen.getByRole('alert'))
    expect(screen.getByRole('button', { name: 'I agree' })).toBeEnabled()
    expect(screen.getByText('status:pending')).toBeInTheDocument()
    expect(screen.getByText('consentAccepted:false')).toBeInTheDocument()
  })

  it('shows a general message for errors that are not API errors', async () => {
    putConsentMock.mockRejectedValue(new TypeError('boom'))
    await renderNotice()

    fireEvent.click(screen.getByRole('button', { name: 'I agree' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
  })

  it('clears the error when the student tries again, and closes on success', async () => {
    putConsentMock
      .mockRejectedValueOnce(apiError(500, 'The server had a problem.'))
      .mockResolvedValueOnce({ consentAcceptedAt: '2026-10-31T08:00:00Z' })
    await renderNotice()
    fireEvent.click(screen.getByRole('button', { name: 'I agree' }))
    await screen.findByRole('alert')

    fireEvent.click(screen.getByRole('button', { name: 'I agree' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(putConsentMock).toHaveBeenCalledTimes(2)
  })
})

describe('ConsentNotice Not now', () => {
  it('closes the dialog, remembers the choice for this tab and shows the banner', async () => {
    await renderNotice()

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(BANNER_TEXT)
    expect(screen.getByRole('button', { name: 'Turn on tracking' })).toBeInTheDocument()
    expect(sessionStorage.getItem(CONSENT_DECLINED_KEY)).not.toBeNull()
    expect(putConsentMock).not.toHaveBeenCalled()
  })

  it('leaves the rest of the page usable', async () => {
    await renderNotice()

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))

    expect(screen.getByRole('button', { name: 'Run tests' })).toBeEnabled()
  })

  it('shows only the banner, with no dialog, when the tab declined earlier', async () => {
    sessionStorage.setItem(CONSENT_DECLINED_KEY, 'true')

    await renderNotice()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(BANNER_TEXT)
  })
})

describe('ConsentNotice Turn on tracking', () => {
  async function renderDeclined() {
    sessionStorage.setItem(CONSENT_DECLINED_KEY, 'true')
    return renderNotice()
  }

  it('reopens the dialog', async () => {
    await renderDeclined()

    fireEvent.click(screen.getByRole('button', { name: 'Turn on tracking' }))

    expect(screen.getByRole('dialog', { name: CONSENT_TITLE })).toBeInTheDocument()
  })

  it('accepts from the reopened dialog: closes it, removes the banner and records the acceptance', async () => {
    putConsentMock.mockResolvedValue({ consentAcceptedAt: '2026-10-31T08:00:00Z' })
    await renderDeclined()
    fireEvent.click(screen.getByRole('button', { name: 'Turn on tracking' }))

    fireEvent.click(screen.getByRole('button', { name: 'I agree' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument()
    expect(screen.getByText('status:accepted')).toBeInTheDocument()
    expect(sessionStorage.getItem(CONSENT_DECLINED_KEY)).toBeNull()
  })

  it('goes back to the banner on Not now', async () => {
    await renderDeclined()
    fireEvent.click(screen.getByRole('button', { name: 'Turn on tracking' }))

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(BANNER_TEXT)
    expect(putConsentMock).not.toHaveBeenCalled()
  })

  it('keeps the dialog open with the error when the request fails, and the banner stays', async () => {
    putConsentMock.mockRejectedValue(apiError(500, 'The server had a problem.'))
    await renderDeclined()
    fireEvent.click(screen.getByRole('button', { name: 'Turn on tracking' }))

    fireEvent.click(screen.getByRole('button', { name: 'I agree' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The server had a problem.')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('status:declined')).toBeInTheDocument()
  })
})
