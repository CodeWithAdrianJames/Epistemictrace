import { Link, NavLink, useNavigate } from 'react-router'
import type { Role } from '../api/authApi.ts'
import { useAuth } from '../auth/AuthProvider.tsx'
import BrandLogo from '../components/BrandLogo.tsx'
import Icon, { type IconName } from '../components/Icon.tsx'
import Mascot from '../components/Mascot.tsx'
import styles from './TopBar.module.css'

interface NavItem {
  to: string
  label: string
  icon: IconName
}

export type TopBarVariant = 'bar' | 'sidebar'

interface TopBarProps {
  // ui-context.md → Navigation: a sidebar on signed-in pages, a slim bar for guests and the workspace.
  variant?: TopBarVariant
}

// Spec 07 R9 / ui-context.md → Layout Patterns: links per role.
const navItemsByRole: Record<Role, NavItem[]> = {
  STUDENT: [
    { to: '/student/activities', label: 'Activities', icon: 'calendar' },
    { to: '/student/history', label: 'History', icon: 'history' },
  ],
  INSTRUCTOR: [{ to: '/instructor/activities', label: 'My activities', icon: 'home' }],
}

const ROLE_LABELS: Record<Role, string> = {
  STUDENT: 'Student',
  INSTRUCTOR: 'Instructor',
}

// Links, user name and Log out appear only for a signed-in user.
function TopBar({ variant = 'bar' }: TopBarProps) {
  const auth = useAuth()
  const navigate = useNavigate()
  const user = auth.status === 'authenticated' ? auth.user : null

  function handleLogout() {
    auth.logout()
    // Replace the protected page so Back does not return to it.
    navigate('/login', { replace: true })
  }

  return (
    <header className={`${styles.topBar} ${styles[variant]}`}>
      <div className={styles.brand}>
        <Link to="/" className={styles.productName}>
          <BrandLogo />
        </Link>
        {user && variant === 'sidebar' && <span className={styles.roleCaption}>{ROLE_LABELS[user.role]}</span>}
      </div>
      {user && (
        <>
          <nav aria-label="Main" className={styles.nav}>
            <ul className={styles.navList}>
              {navItemsByRole[user.role].map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) => (isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink)}
                  >
                    <Icon name={item.icon} className={styles.navIcon} />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className={styles.account}>
            <span className={styles.avatar} aria-hidden="true">
              <Mascot className={styles.avatarMascot} />
            </span>
            <span className={styles.accountText}>
              <span className={styles.userName}>{user.name}</span>
              <span className={styles.userRole}>{ROLE_LABELS[user.role]} mode</span>
            </span>
            <button type="button" className={styles.logout} onClick={handleLogout}>
              <Icon name="logOut" className={styles.logoutIcon} />
              Log out
            </button>
          </div>
        </>
      )}
    </header>
  )
}

export default TopBar
