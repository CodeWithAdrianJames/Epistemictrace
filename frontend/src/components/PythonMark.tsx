import type { SvgFrame } from './Mascot.tsx'
import styles from './PythonMark.module.css'

interface PythonMarkProps {
  className?: string
  frame?: SvgFrame
}

// The two-snake Python mark from the UI reference: activities, script tabs and examples are all Python.
// Decorative, so hidden from assistive technology.
// Inside an illustration the frame sizes the mark, so the inline 1.25em size is left off.
function PythonMark({ className, frame }: PythonMarkProps) {
  const classes = [frame ? '' : styles.mark, className ?? ''].filter(Boolean).join(' ')
  return (
    <svg
      className={classes || undefined}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      {...frame}
    >
      <path
        className={styles.blue}
        d="M15.9 3C9.5 3 9.9 5.8 9.9 5.8v2.9h6.2v.9H7.5S3 9.1 3 15.6s3.9 6.3 3.9 6.3h2.3v-3s-.1-3.9 3.9-3.9h6.1s3.7.1 3.7-3.6V6.6S23.5 3 15.9 3zm-3.4 2.1a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z"
      />
      <path
        className={styles.yellow}
        d="M16.1 29c6.4 0 6-2.8 6-2.8v-2.9h-6.2v-.9h8.6s4.5.5 4.5-6-3.9-6.3-3.9-6.3h-2.3v3s.1 3.9-3.9 3.9h-6.1s-3.7-.1-3.7 3.6v6.1S8.5 29 16.1 29zm3.4-2.1a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4z"
      />
    </svg>
  )
}

export default PythonMark
