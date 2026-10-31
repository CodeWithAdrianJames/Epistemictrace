// The code draft is the only thing kept in localStorage, one entry per user and activity.
// Storage can be unavailable (private mode, blocked site data, full quota), so every call
// swallows its errors: the editor keeps working, the draft just does not survive a refresh.
const KEY_PREFIX = 'epistemictrace:draft'

// userId is the logged-in user's id, or 'local' before one is known; activityId may come
// straight from a route parameter.
export type DraftId = string | number

export function loadDraft(userId: DraftId, activityId: DraftId): string | null {
  try {
    return localStorage.getItem(draftKey(userId, activityId))
  } catch {
    return null
  }
}

export function saveDraft(userId: DraftId, activityId: DraftId, code: string): void {
  try {
    localStorage.setItem(draftKey(userId, activityId), code)
  } catch {
    // Ignored: see the note at the top of this file.
  }
}

export function clearDraft(userId: DraftId, activityId: DraftId): void {
  try {
    localStorage.removeItem(draftKey(userId, activityId))
  } catch {
    // Ignored: see the note at the top of this file.
  }
}

function draftKey(userId: DraftId, activityId: DraftId): string {
  return `${KEY_PREFIX}:${userId}:${activityId}`
}
