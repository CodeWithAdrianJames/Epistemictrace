import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/ApiError.ts'
import { submitReflection, type ReflectionResult } from '../../api/sessionsApi.ts'
import ReflectionForm from './ReflectionForm.tsx'

vi.mock('../../api/sessionsApi.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/sessionsApi.ts')>()),
  submitReflection: vi.fn(),
}))

// The form only needs a request runner that passes a token; 401 handling is spec 07's.
vi.mock('../../auth/useProtectedRequest.ts', () => ({
  useProtectedRequest: () => async (call: (token: string) => Promise<unknown>) => call('token-7'),
}))

const submitMock = vi.mocked(submitReflection)

const HYPOTHESIS = 'The loop never stops at n.'
const PLANNED_FIX = 'Print i before the check.'

const RESULT: ReflectionResult = {
  reflectionId: 3,
  submittedAt: '2026-11-03T02:30:00Z',
  breaker: { state: 'COOLDOWN', cooldownEndsAt: '2026-11-03T02:40:00Z', reflectionMinLength: 20 },
}

function renderForm(minLength = 20) {
  const onSubmitted = vi.fn()
  const onNotLocked = vi.fn()
  render(<ReflectionForm sessionId={5} minLength={minLength} onSubmitted={onSubmitted} onNotLocked={onNotLocked} />)
  return { onSubmitted, onNotLocked }
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function fillBoth(hypothesis = HYPOTHESIS, plannedFix = PLANNED_FIX) {
  fill('What do you think is wrong?', hypothesis)
  fill('What will you try next?', plannedFix)
}

function apiError(status: number, detail: string, fieldErrors: Record<string, string> = {}): ApiError {
  return new ApiError({ status, title: `HTTP ${status}`, detail, fieldErrors })
}

afterEach(() => {
  vi.resetAllMocks()
})

describe('ReflectionForm', () => {
  it('shows the two labelled fields and a disabled Continue button', () => {
    renderForm()

    expect(screen.getByLabelText('What do you think is wrong?').tagName).toBe('TEXTAREA')
    expect(screen.getByLabelText('What will you try next?').tagName).toBe('TEXTAREA')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })

  it('counts trimmed characters against the minimum until it is reached', () => {
    renderForm(20)
    expect(screen.getAllByText('0 / 20 characters')).toHaveLength(2)

    fill('What do you think is wrong?', '   seven c   ')
    expect(screen.getByText('7 / 20 characters')).toBeInTheDocument()

    fill('What do you think is wrong?', HYPOTHESIS)
    expect(screen.getAllByText(/ \/ 20 characters/)).toHaveLength(1)
  })

  it('takes the minimum from its prop', () => {
    renderForm(5)
    expect(screen.getAllByText('0 / 5 characters')).toHaveLength(2)
    fillBoth('12345', '1234 ')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    fill('What will you try next?', '12345')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })

  it('enables Continue only when both trimmed fields reach the minimum', () => {
    renderForm()
    fill('What do you think is wrong?', HYPOTHESIS)
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    fill('What will you try next?', `   ${'x'.repeat(19)}   `)
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    fill('What will you try next?', PLANNED_FIX)
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })

  it('submits both fields, shows Saving… and passes the new breaker on', async () => {
    let resolve: (result: ReflectionResult) => void = () => undefined
    submitMock.mockReturnValue(
      new Promise<ReflectionResult>((done) => {
        resolve = done
      }),
    )
    const { onSubmitted } = renderForm()
    fillBoth()

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(submitMock).toHaveBeenCalledWith('token-7', 5, { hypothesis: HYPOTHESIS, plannedFix: PLANNED_FIX })
    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled()
    await act(async () => resolve(RESULT))
    expect(onSubmitted).toHaveBeenCalledWith(RESULT.breaker)
  })

  it('shows 400 field errors under the fields and keeps the text', async () => {
    submitMock.mockRejectedValue(
      apiError(400, 'Write at least 20 characters.', { hypothesis: 'Write at least 20 characters.' }),
    )
    const { onSubmitted } = renderForm()
    fillBoth()

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Write at least 20 characters.')).toBeInTheDocument()
    expect(screen.getByLabelText('What do you think is wrong?')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('What do you think is wrong?')).toHaveValue(HYPOTHESIS)
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
    expect(onSubmitted).not.toHaveBeenCalled()
  })

  it('reports a 409 so the page can close the panel', async () => {
    submitMock.mockRejectedValue(apiError(409, "Tests aren't paused right now."))
    const { onNotLocked, onSubmitted } = renderForm()
    fillBoth()

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await vi.waitFor(() => expect(onNotLocked).toHaveBeenCalledTimes(1))
    expect(onSubmitted).not.toHaveBeenCalled()
  })

  it('shows the detail of other errors and keeps the typed text', async () => {
    submitMock.mockRejectedValue(apiError(0, "Can't reach the server. Check your connection."))
    renderForm()
    fillBoth()

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server. Check your connection.")
    expect(screen.getByLabelText('What do you think is wrong?')).toHaveValue(HYPOTHESIS)
    expect(screen.getByLabelText('What will you try next?')).toHaveValue(PLANNED_FIX)
  })

  it('stores nothing in browser storage', async () => {
    submitMock.mockRejectedValue(apiError(500, 'Boom'))
    renderForm()
    fillBoth()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('alert')

    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })
})
