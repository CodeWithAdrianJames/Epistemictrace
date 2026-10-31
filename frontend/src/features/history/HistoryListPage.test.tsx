import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/ApiError.ts'
import { listSessions, type HistoryItem, type HistoryPage } from '../../api/historyApi.ts'
import HistoryListPage from './HistoryListPage.tsx'
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

const listMock = vi.mocked(listSessions)

function item(id: number, overrides: Partial<HistoryItem> = {}): HistoryItem {
  return {
    sessionId: id,
    activityId: 42,
    activityTitle: `Activity ${id}`,
    startedAt: '2026-11-03T02:15:00Z',
    endedAt: '2026-11-03T02:40:00Z',
    durationSeconds: 1500,
    runCount: 4,
    reflectionCount: 2,
    ...overrides,
  }
}

function page(items: HistoryItem[], pageNumber = 0, totalItems = items.length): HistoryPage {
  return { items, page: pageNumber, size: 20, totalItems }
}

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: '/student/history', element: <HistoryListPage /> },
      { path: '/student/history/:sessionId', element: <h1>Session page</h1> },
      { path: '/student/activities', element: <h1>Activities</h1> },
    ],
    { initialEntries: ['/student/history'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

afterEach(() => {
  vi.resetAllMocks()
})

describe('HistoryListPage', () => {
  it('shows a loading message, then one row per session with date, title, duration and reflections', async () => {
    listMock.mockResolvedValue(
      page([
        item(7, { activityTitle: 'Loops', durationSeconds: 3900, reflectionCount: 1 }),
        item(6, { activityTitle: 'Sums', endedAt: null, durationSeconds: null, reflectionCount: 0 }),
      ]),
    )
    renderPage()
    expect(screen.getByText('Loading your sessions…')).toBeInTheDocument()

    const rows = within(await screen.findByRole('list', { name: 'Sessions' })).getAllByRole('listitem')

    expect(screen.getByRole('heading', { level: 1, name: 'My history' })).toBeInTheDocument()
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('Loops')
    expect(rows[0]).toHaveTextContent(formatDateTime('2026-11-03T02:15:00Z'))
    expect(rows[0]).toHaveTextContent('1 h 5 min')
    expect(rows[0]).toHaveTextContent('1 reflection')
    expect(rows[1]).toHaveTextContent('In progress')
    expect(rows[1]).toHaveTextContent('0 reflections')
    expect(listMock).toHaveBeenCalledWith('token-7', 0, expect.any(AbortSignal))
  })

  it('links each row to its detail page', async () => {
    listMock.mockResolvedValue(page([item(7, { activityTitle: 'Loops' })]))
    const router = renderPage()

    fireEvent.click(await screen.findByRole('link', { name: /Loops/ }))

    expect(router.state.location.pathname).toBe('/student/history/7')
  })

  it('never shows an SDI number or word', async () => {
    listMock.mockResolvedValue(page([item(7)]))
    renderPage()
    const list = await screen.findByRole('list', { name: 'Sessions' })
    expect(list.textContent).not.toMatch(/SDI|struggl/i)
  })

  it('shows the empty state with a link to Activities', async () => {
    listMock.mockResolvedValue(page([]))
    const router = renderPage()

    expect(await screen.findByText("You haven't worked on any activities yet.")).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Pages' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Go to Activities' }))
    expect(router.state.location.pathname).toBe('/student/activities')
  })

  it('has no paging buttons when everything fits on one page', async () => {
    listMock.mockResolvedValue(page([item(1)], 0, 1))
    renderPage()
    await screen.findByRole('list', { name: 'Sessions' })
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument()
  })

  it('pages with Previous and Next', async () => {
    listMock.mockImplementation(async (_token, pageNumber) =>
      page([item(100 - pageNumber, { activityTitle: `Page ${pageNumber}` })], pageNumber, 45),
    )
    renderPage()
    await screen.findByText('Page 0')
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Page 1')
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Page 2')

    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    await screen.findByText('Page 1')
    expect(listMock.mock.calls.map((call) => call[1])).toEqual([0, 1, 2, 1])
  })

  it('shows the API error detail at the top', async () => {
    listMock.mockRejectedValue(new ApiError({ status: 500, title: 'Error', detail: 'Server trouble.', fieldErrors: {} }))
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Server trouble.')
  })
})
