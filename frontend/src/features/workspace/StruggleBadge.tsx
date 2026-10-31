import styles from './StruggleBadge.module.css'
import type { StruggleLevel } from './useStruggleLevel.ts'

// ui-context.md → Struggle Level Badge. Never a number, percentage, progress bar or "SDI" (invariant 5).
const TEXT: Record<StruggleLevel, string> = {
  LOW: 'Steady',
  MEDIUM: 'Take a moment',
  HIGH: 'Time to pause and plan',
}

const CLASS: Record<StruggleLevel, string> = {
  LOW: styles.low,
  MEDIUM: styles.medium,
  HIGH: styles.high,
}

// Spec 28 R2, R3. The live region stays mounted so a screen reader announces each change, and it is
// empty until the first scored run.
function StruggleBadge({ level }: { level: StruggleLevel | null }) {
  return (
    <span aria-live="polite" className={styles.region}>
      {level !== null && <span className={`${styles.badge} ${CLASS[level]}`}>{TEXT[level]}</span>}
    </span>
  )
}

export default StruggleBadge
