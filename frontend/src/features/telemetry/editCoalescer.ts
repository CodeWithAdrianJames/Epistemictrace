import type { EditorChange } from '../workspace/CodeEditor.tsx'

// Q4: consecutive editor changes less than this far apart become one EDIT event.
export const EDIT_COALESCE_MS = 2000

export interface CoalescedEdit {
  charsAdded: number
  charsRemoved: number
  // Time of the last change in the group (ms since the epoch).
  at: number
}

export interface EditCoalescer {
  push(change: EditorChange): void
  // Emits the pending edit now, if there is one.
  flush(): void
  // Drops the pending edit and its timer without emitting it.
  dispose(): void
}

// Spec 17 R2. A group whose changes add and remove nothing (Monaco can report an empty replace)
// is not emitted: the server rejects an EDIT with both counts at 0 (spec 18 R2).
export function createEditCoalescer(onEdit: (edit: CoalescedEdit) => void): EditCoalescer {
  let pending: CoalescedEdit | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function flush(): void {
    clearTimer()
    const edit = pending
    pending = null
    if (edit && (edit.charsAdded > 0 || edit.charsRemoved > 0)) {
      onEdit(edit)
    }
  }

  function push(change: EditorChange): void {
    if (pending && change.at - pending.at >= EDIT_COALESCE_MS) {
      flush()
    }
    pending = pending
      ? {
          charsAdded: pending.charsAdded + change.charsAdded,
          charsRemoved: pending.charsRemoved + change.charsRemoved,
          at: change.at,
        }
      : { charsAdded: change.charsAdded, charsRemoved: change.charsRemoved, at: change.at }
    clearTimer()
    timer = setTimeout(flush, EDIT_COALESCE_MS)
  }

  function dispose(): void {
    clearTimer()
    pending = null
  }

  return { push, flush, dispose }
}
