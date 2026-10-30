import { Link, NavLink, useNavigate } from 'react-router'
import type { Role } from '../api/authApi.ts'
import { useAuth } from '../auth/AuthProvider.tsx'
import styles from './TopBar.module.css'

interface NavItem {
  to: string
  label: string
}

// Spec 07 R9 / ui-context.md → Layout Patterns: links per role.
const navItemsByRole: Record<Role, NavItem[]> = {
  STUDENT: [
    { to: '/student/activities', label: 'Activities' },
    { to: '/student/history', label: 'History' },
  ],
  INSTRUCTOR: [{ to: '/instructor/activities', label: 'My activities' }],
}

// Links, user name and Log out appear only for a signed-in user.
function TopBar() {
  const auth = useAuth()
  const navigate = useNavigate()
  const user = auth.status === 'authenticated' ? auth.user : null

  function handleLogout() {
    auth.logout()
    // Replace the protected page so Back does not return to it.
    navigate('/login', { replace: true })
  }

  return (
    <header className={styles.topBar}>
      <Link to="/" className={styles.productName}>
        EpistemicTrace
      </Link>
      {user && (
        <>
          <nav aria-label="Main">
            <ul className={styles.navList}>
              {navItemsByRole[user.role].map((item) => (
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
          <div className={styles.account}>
            <span className={styles.userName}>{user.name}</span>
            <button type="button" className={styles.logout} onClick={handleLogout}>
              Log out
            </button>
          </div>
        </>
      )}
    </header>
  )
}

export default TopBar
