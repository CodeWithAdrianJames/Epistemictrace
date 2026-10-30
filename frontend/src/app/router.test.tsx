import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { AuthProvider } from '../auth/AuthProvider.tsx'
import styles from './AppLayout.module.css'
import { routes } from './router.tsx'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
  return router
}

// No stored token, so AuthProvider starts anonymous and never calls the API.
afterEach(() => {
  sessionStorage.clear()
})

describe('router', () => {
  it.each([
    ['/login', 'Log in'],
    ['/register', 'Create an account'],
    ['/student/activities', 'Activities'],
    ['/student/activities/42', 'Activity workspace'],
    ['/student/history', 'My history'],
    ['/student/history/7', 'Session details'],
    ['/instructor/activities', 'My activities'],
    ['/instructor/activities/new', 'New activity'],
    ['/instructor/activities/42', 'Edit activity'],
    ['/nope', 'Page not found'],
    ['/student/nope/deeper', 'Page not found'],
  ])('renders %s with the heading "%s"', (path, title) => {
    renderAt(path)

    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
  })

  it('redirects / to /login', () => {
    const router = renderAt('/')

    expect(router.state.location.pathname).toBe('/login')
    expect(screen.getByRole('heading', { level: 1, name: 'Log in' })).toBeInTheDocument()
  })

  it('shows the top bar with the product name and static links', () => {
    renderAt('/login')

    expect(screen.getByRole('link', { name: 'EpistemicTrace' })).toHaveAttribute('href', '/')
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Activities' })).toHaveAttribute('href', '/student/activities')
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('href', '/student/history')
    expect(screen.getByRole('link', { name: 'My activities' })).toHaveAttribute('href', '/instructor/activities')
  })

  it('marks the link for the current section as the current page', () => {
    renderAt('/student/history/7')

    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Activities' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'My activities' })).not.toHaveAttribute('aria-current')
  })

  it('uses the full width for the activity workspace', () => {
    renderAt('/student/activities/42')

    const main = screen.getByRole('main')
    expect(main).toHaveClass(styles.contentFull)
    expect(main).not.toHaveClass(styles.contentContained)
  })

  it.each(['/login', '/student/activities', '/instructor/activities/42', '/nope'])(
    'limits the content width on %s',
    (path) => {
      renderAt(path)

      const main = screen.getByRole('main')
      expect(main).toHaveClass(styles.contentContained)
      expect(main).not.toHaveClass(styles.contentFull)
    },
  )
})
