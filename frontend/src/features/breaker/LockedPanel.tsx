import { useEffect, useRef, type ReactNode } from 'react'
import styles from './LockedPanel.module.css'

export const LOCKED_HEADING = "Let's pause and plan"
export const LOCKED_BODY =
  "You've run the tests several times in a short while. Before the next run, write down what you think is going wrong and what you'll change. You can keep editing your code while you write."

interface LockedPanelProps {
  // The reflection form (spec 25).
  children?: ReactNode
}

// Spec 23 R4, ui-context.md → Breaker Panel: not a modal, so the editor and problem statement stay
// usable. Focus moves to the heading when the panel appears.
function LockedPanel({ children }: LockedPanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <section className={styles.panel} aria-labelledby="locked-panel-heading">
      <h2 id="locked-panel-heading" ref={headingRef} tabIndex={-1} className={styles.heading}>
        {LOCKED_HEADING}
      </h2>
      <p className={styles.body}>{LOCKED_BODY}</p>
      {children}
    </section>
  )
}

export default LockedPanel
