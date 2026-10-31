import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { ApiError } from '../../api/ApiError.ts'
import { CONSENT_PARAGRAPHS, CONSENT_TITLE } from './consentText.ts'
import styles from './ConsentNotice.module.css'
import type { Consent } from './useConsent.ts'

const FALLBACK_DETAIL = 'Something went wrong. Please try again.'

interface ConsentNoticeProps {
  consent: Consent
}

// Spec 15 R3–R5: the notice as a dialog while the choice is pending, and the banner after "Not now".
// The banner's link reopens the same dialog; the dialog is portaled so the banner can sit in the page flow.
function ConsentNotice({ consent }: ConsentNoticeProps) {
  const { status, accept, decline } = consent
  const [reopened, setReopened] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const showDialog = status === 'pending' || (status === 'declined' && reopened)

  async function handleAgree() {
    setSubmitting(true)
    setError(null)
    try {
      await accept()
      setReopened(false)
    } catch (caught: unknown) {
      setError(caught instanceof ApiError ? caught.detail : FALLBACK_DETAIL)
    } finally {
      setSubmitting(false)
    }
  }

  function handleNotNow() {
    setError(null)
    setReopened(false)
    decline()
  }

  return (
    <>
      {status === 'declined' && (
        <div role="status" className={styles.banner}>
          <p className={styles.bannerText}>
            Tracking is off for this visit, so tests won't pause and nothing is recorded.
          </p>
          <button type="button" className={styles.bannerAction} onClick={() => setReopened(true)}>
            Turn on tracking
          </button>
        </div>
      )}
      {showDialog &&
        createPortal(
          <ConsentDialog submitting={submitting} error={error} onAgree={() => void handleAgree()} onNotNow={handleNotNow} />,
          document.body,
        )}
    </>
  )
}

interface ConsentDialogProps {
  submitting: boolean
  error: string | null
  onAgree: () => void
  onNotNow: () => void
}

// The backdrop blocks the pointer; the Tab trap below keeps the keyboard inside until a choice is made.
function ConsentDialog({ submitting, error, onAgree, onNotNow }: ConsentDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  function trapTab(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab' || !dialogRef.current) {
      return
    }
    const buttons = dialogRef.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
    if (buttons.length === 0) {
      event.preventDefault()
      return
    }
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    const active = document.activeElement
    if (event.shiftKey && (active === first || active === dialogRef.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className={styles.backdrop}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        aria-describedby="consent-body"
        tabIndex={-1}
        className={styles.dialog}
        onKeyDown={trapTab}
      >
        <h2 id="consent-title" className={styles.title}>
          {CONSENT_TITLE}
        </h2>
        <div id="consent-body" className={styles.body}>
          {CONSENT_PARAGRAPHS.map((paragraph) => (
            <p key={paragraph} className={styles.paragraph}>
              {paragraph}
            </p>
          ))}
        </div>
        {error !== null && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.primary} disabled={submitting} onClick={onAgree}>
            I agree
          </button>
          <button type="button" className={styles.secondary} disabled={submitting} onClick={onNotNow}>
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConsentNotice
