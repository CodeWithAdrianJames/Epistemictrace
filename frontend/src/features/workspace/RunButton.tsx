import styles from './RunButton.module.css'

export type RunButtonState = 'preparing' | 'ready' | 'running' | 'failed'

interface RunButtonProps {
  state: RunButtonState
  onRun: () => void
}

// ui-context.md → Run Tests Button. The locked and cooldown states come with specs 22–23.
const LABELS: Record<RunButtonState, string> = {
  preparing: 'Preparing Python…',
  ready: 'Run tests',
  running: 'Running…',
  failed: 'Run tests',
}

// ui-context.md → Accessibility: a disabled button has aria-disabled and a visible reason. The
// label is the reason while preparing or running; a failed start-up gets its own message.
function RunButton({ state, onRun }: RunButtonProps) {
  const disabled = state !== 'ready'

  return (
    <div className={styles.wrapper}>
      {state === 'failed' && (
        <p role="alert" className={styles.reason}>
          Python couldn't start. Refresh the page to try again.
        </p>
      )}
      <button type="button" className={styles.button} disabled={disabled} aria-disabled={disabled} onClick={onRun}>
        {LABELS[state]}
      </button>
    </div>
  )
}

export default RunButton
