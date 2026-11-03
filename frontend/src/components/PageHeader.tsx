import type { ReactNode } from 'react'
import styles from './PageHeader.module.css'

interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  // Page-level actions (New activity, Back links), placed after the heading in the DOM.
  actions?: ReactNode
}

// ui-context.md → Layout Patterns: the gradient page heading from the instructor dashboard reference.
function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.text}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}

export default PageHeader
