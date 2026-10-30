import { Link, NavLink, Outlet, useMatches } from 'react-router'
import styles from './AppLayout.module.css'

interface NavItem {
  to: string
  label: string
}

// Static for now; spec 07 shows only the links for the signed-in user's role.
const navItems: NavItem[] = [
  { to: '/student/activities', label: 'Activities' },
  { to: '/student/history', label: 'History' },
  { to: '/instructor/activities', label: 'My activities' },
]

// Routes opt out of the 1200px content width with `handle: { fullWidth: true }`.
function isFullWidthHandle(handle: unknown): boolean {
  return typeof handle === 'object' && handle !== null && 'fullWidth' in handle && handle.fullWidth === true
}

function AppLayout() {
  const fullWidth = useMatches().some((match) => isFullWidthHandle(match.handle))

  return (
    <div className={styles.shell}>
      <header className={styles.topBar}>
        <Link to="/" className={styles.productName}>
          EpistemicTrace
        </Link>
        <nav aria-label="Main">
          <ul className={styles.navList}>
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) => (isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink)}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className={fullWidth ? styles.contentFull : styles.contentContained}>
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
