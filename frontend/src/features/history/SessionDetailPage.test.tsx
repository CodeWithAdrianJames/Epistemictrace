import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/ApiError.ts'
import { getSession, type SessionDetail } from '../../api/historyApi.ts'
import SessionDetailPage from './SessionDetailPage.tsx'
import { formatDateTime } from './formatDateTime.ts'

vi.mock('../../api/historyApi.ts', () => ({
  listSessions: vi.fn(),
  getSession: vi.fn(),
}))

// One stable runner, like the real hook's memoized callback, so effects do not re-run on every render.
const { request } = vi.hoisted(() => ({
  request: async (call: (token: string) => Promise<unknown>) => call('token-7'),
}))

vi.mock('../../auth/useProtectedRequest.ts', () => ({
  useProtectedRequest: () => request,
}))

const getMock = vi.mocked(getSession)

const SESSION: SessionDetail = {
  sessionId: 7,
  activityId: 42,
  activityTitle: 'Loops',
  startedAt: '2026-11-03T02:15:00Z',
  endedAt: '2026-11-03T02:40:00Z',
  durationSeconds: 1500,
  runCount: 9,
  reflectionCount: 2,
  reflections: [
    {
      hypothesis: 'The loop never stops.\nIt keeps adding.',
      plannedFix: 'Check the <b>condition</b> first.',
      submittedAt: '2026-11-03T02:20:00Z',
    },
    { hypothesis: 'Off by one at the end.', plannedFix: 'Use range(n + 1).', submittedAt: '2026-11-03T02:35:00Z' },
  ],
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/student/history/:sessionId', element: <SessionDetailPage /> },
      { path: '/student/history', element: <h1>My history</h1> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

function apiError(status: number): ApiError {
  return new ApiError({ status, title: `HTTP ${status}`, detail: 'Server detail.', fieldErrors: {} })
}

afterEach(() => {
  vi.resetAllMocks()
})

describe('SessionDetailPage', () => {
  it('shows the title, date, duration, runs and each reflection as a card', async () => {
    getMock.mockResolvedValue(SESSION)
    renderAt('/student/history/7')
    expect(screen.getByText('Loading session…')).toBeInTheDocument()

    expect(await screen.findByRole('heading', { level: 1, name: 'Loops' })).toBeInTheDocument()
    expect(getMock).toHaveBeenCalledWith('token-7', 7, expect.any(AbortSignal))
    expect(screen.getByText(formatDateTime(SESSION.startedAt))).toBeInTheDocument()
    expect(screen.getByText('25 min')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()

    const cards = within(screen.getByRole('list', { name: 'Reflections' })).getAllByRole('listitem')
    expect(cards).toHaveLength(2)
    expect(cards[0]).toHaveTextContent(formatDateTime('2026-11-03T02:20:00Z'))
    expect(within(cards[0]).getByRole('heading', { name: 'What I thought was wrong' })).toBeInTheDocument()
    expect(within(cards[0]).getByRole('heading', { name: 'What I planned to try' })).toBeInTheDocument()
    expect(cards[1]).toHaveTextContent('Off by one at the end.')
  })

  it('renders reflection text literally, keeping line breaks', async () => {
    getMock.mockResolvedValue(SESSION)
    renderAt('/student/history/7')

    const fix = await screen.findByText('Check the <b>condition</b> first.')
    expect(fix.querySelector('b')).toBeNull()
    const hypothesis = screen.getByText((_, element) => element?.textContent === 'The loop never stops.\nIt keeps adding.')
    expect(hypothesis.tagName).toBe('P')
  })

  it('says when there were no pauses', async () => {
    getMock.mockResolvedValue({ ...SESSION, reflectionCount: 0, reflections: [] })
    renderAt('/student/history/7')
    expect(await screen.findByText('No pauses in this session.')).toBeInTheDocument()
  })

  it.each([403, 404])('shows "This session isn\'t available." for %s', async (status) => {
    getMock.mockRejectedValue(apiError(status))
    renderAt('/student/history/7')
    expect(await screen.findByText("This session isn't available.")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to My history' })).toBeInTheDocument()
  })

  it('treats an id that is not a number as not available without a request', () => {
    renderAt('/student/history/abc')
    expect(screen.getByText("This session isn't available.")).toBeInTheDocument()
    expect(getMock).not.toHaveBeenCalled()
  })

  it('shows other API errors with their detail', async () => {
    getMock.mockRejectedValue(apiError(500))
    renderAt('/student/history/7')
    expect(await screen.findByRole('alert')).toHaveTextContent('Server detail.')
  })

  it('never shows an SDI number or word', async () => {
    getMock.mockResolvedValue(SESSION)
    renderAt('/student/history/7')
    await screen.findByRole('heading', { level: 1, name: 'Loops' })
    expect(document.body.textContent).not.toMatch(/SDI|struggl/i)
  })
})
