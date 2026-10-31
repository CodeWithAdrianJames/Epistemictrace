import type { Ref } from 'react'
import styles from './RunButton.module.css'

export type RunButtonState = 'preparing' | 'ready' | 'running' | 'waiting' | 'locked' | 'failed'

interface RunButtonProps {
  state: RunButtonState
  onRun: () => void
  // Spec 25 R3: the page moves focus back here after a reflection.
  ref?: Ref<HTMLButtonElement>
}

// ui-context.md → Run Tests Button. 'waiting' is the wait for the server after a run (≤ 5 s,
// spec 23 R2); 'locked' is the breaker (R3). Cooldown is plain 'ready'.
const LABELS: Record<RunButtonState, string> = {
  preparing: 'Preparing Python…',
  ready: 'Run tests',
  running: 'Running…',
  waiting: 'Running…',
  locked: 'Paused — see below',
  failed: 'Run tests',
}

// ui-context.md → Accessibility: a disabled button has aria-disabled and a visible reason. The
// label is the reason while preparing, running, waiting or locked; a failed start-up gets its own message.
function RunButton({ state, onRun, ref }: RunButtonProps) {
  const disabled = state !== 'ready'

  return (
    <div className={styles.wrapper}>
      {state === 'failed' && (
        <p role="alert" className={styles.reason}>
          Python couldn't start. Refresh the page to try again.
        </p>
      )}
      <button ref={ref} type="button" className={styles.button} disabled={disabled} aria-disabled={disabled} onClick={onRun}>
        {LABELS[state]}
      </button>
    </div>
  )
}

export default RunButton
