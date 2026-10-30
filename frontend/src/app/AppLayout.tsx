import { Outlet, useMatches } from 'react-router'
import styles from './AppLayout.module.css'
import TopBar from './TopBar.tsx'

// Routes opt out of the 1200px content width with `handle: { fullWidth: true }`.
function isFullWidthHandle(handle: unknown): boolean {
  return typeof handle === 'object' && handle !== null && 'fullWidth' in handle && handle.fullWidth === true
}

function AppLayout() {
  const fullWidth = useMatches().some((match) => isFullWidthHandle(match.handle))

  return (
    <div className={styles.shell}>
      <TopBar />
      <main className={fullWidth ? styles.contentFull : styles.contentContained}>
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
