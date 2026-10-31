import { useCallback, useEffect, useRef, useState } from 'react'
import { loadDraft, saveDraft, type DraftId } from './draftStore.ts'

const SAVE_DELAY_MS = 500

interface Draft {
  userId: DraftId
  activityId: DraftId
  code: string
}

// Holds the code for one user and activity. The first value is the saved draft, or starterCode
// when there is none; later changes are saved 500 ms after the last one, and at once on pagehide
// and on unmount so a refresh or a route change does not lose the last edits.
export function useDraft(
  userId: DraftId,
  activityId: DraftId,
  starterCode: string,
): [string, (code: string) => void] {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(userId, activityId, starterCode))
  const pendingRef = useRef<Draft | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Another user or activity: show its own draft instead of carrying the old code over.
  let current = draft
  if (draft.userId !== userId || draft.activityId !== activityId) {
    current = initialDraft(userId, activityId, starterCode)
    setDraft(current)
  }

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const pending = pendingRef.current
    pendingRef.current = null
    if (pending) {
      saveDraft(pending.userId, pending.activityId, pending.code)
    }
  }, [])

  const setCode = useCallback(
    (code: string) => {
      const next: Draft = { userId, activityId, code }
      setDraft(next)
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
      pendingRef.current = next
      timerRef.current = setTimeout(flush, SAVE_DELAY_MS)
    },
    [userId, activityId, flush],
  )

  // The cleanup also runs when the user or activity changes, so pending code is saved under its own key.
  useEffect(() => {
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [userId, activityId, flush])

  return [current.code, setCode]
}

function initialDraft(userId: DraftId, activityId: DraftId, starterCode: string): Draft {
  return { userId, activityId, code: loadDraft(userId, activityId) ?? starterCode }
}
