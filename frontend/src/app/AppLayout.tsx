import { Outlet, useMatches } from 'react-router'
import { useAuth } from '../auth/AuthProvider.tsx'
import styles from './AppLayout.module.css'
import TopBar from './TopBar.tsx'

// Routes opt out of the 1280px content width with `handle: { fullWidth: true }`.
function isFullWidthHandle(handle: unknown): boolean {
  return typeof handle === 'object' && handle !== null && 'fullWidth' in handle && handle.fullWidth === true
}

// ui-context.md → Layout Patterns: guests get a slim bar over the auth pages; signed-in pages get the
// sidebar, except full-width pages (the workspace), which keep the slim bar for the room.
function AppLayout() {
  const fullWidth = useMatches().some((match) => isFullWidthHandle(match.handle))
  const signedIn = useAuth().status === 'authenticated'
  const layout = !signedIn ? styles.guest : fullWidth ? styles.wide : styles.withSidebar

  return (
    <div className={`${styles.shell} ${layout}`}>
      <TopBar variant={signedIn && !fullWidth ? 'sidebar' : 'bar'} />
      <main className={fullWidth ? styles.contentFull : styles.contentContained}>
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
