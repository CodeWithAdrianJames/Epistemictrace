import { useCallback, useState } from 'react'
import { putConsent } from '../../api/consentApi.ts'
import { useAuth } from '../../auth/AuthProvider.tsx'
import { useProtectedRequest } from '../../auth/useProtectedRequest.ts'

// Spec 15 R5: "Not now" is remembered for this browser tab only.
export const CONSENT_DECLINED_KEY = 'epistemictrace:consent-declined'

export type ConsentStatus = 'accepted' | 'declined' | 'pending'

// Spec 15 R6. Spec 17 starts tracking only when status === 'accepted'.
export interface Consent {
  status: ConsentStatus
  // Rejects with the ApiError when PUT /api/me/consent fails; the status then stays as it was.
  accept: () => Promise<void>
  decline: () => void
}

export function useConsent(): Consent {
  const { user, markConsentAccepted } = useAuth()
  const request = useProtectedRequest()
  const [declined, setDeclined] = useState(readDeclined)

  const accepted = user !== null && user.consentAccepted
  const status: ConsentStatus = accepted ? 'accepted' : declined ? 'declined' : 'pending'

  const accept = useCallback(async () => {
    await request((token) => putConsent(token))
    clearDeclined()
    setDeclined(false)
    markConsentAccepted()
  }, [request, markConsentAccepted])

  const decline = useCallback(() => {
    writeDeclined()
    setDeclined(true)
  }, [])

  return { status, accept, decline }
}

// sessionStorage can throw (blocked site data, private windows). A student who cannot store the
// choice still keeps coding: the choice then lasts only as long as the page does.
function readDeclined(): boolean {
  try {
    return sessionStorage.getItem(CONSENT_DECLINED_KEY) !== null
  } catch {
    return false
  }
}

function writeDeclined(): void {
  try {
    sessionStorage.setItem(CONSENT_DECLINED_KEY, 'true')
  } catch {
    // Keep the in-memory choice only.
  }
}

function clearDeclined(): void {
  try {
    sessionStorage.removeItem(CONSENT_DECLINED_KEY)
  } catch {
    // Nothing stored that could be cleared.
  }
}
