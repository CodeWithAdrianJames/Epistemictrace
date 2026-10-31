import { useCallback, useEffect, useState } from 'react'
import { parseBreaker, type Breaker, type BatchResponse, type SessionStart } from '../../api/sessionsApi.ts'

export type BreakerListenerRegistration = (listener: (response: BatchResponse) => void) => () => void

export interface BreakerStateOptions {
  // null while tracking is off (consent declined, session start failed or still starting).
  startResponse: SessionStart | null
  onBatchResponse: BreakerListenerRegistration
}

export interface BreakerStateResult extends Breaker {
  // Applies a breaker payload the server sent outside a batch (the reflection answer, spec 25).
  apply(breaker: Breaker): void
}

export const UNLOCKED: Breaker = { state: 'UNLOCKED', cooldownEndsAt: null, reflectionMinLength: 0 }

// Spec 23 R1. The server owns the state (Q2); the browser only follows it. The cooldown timer is
// for display: it shows UNLOCKED at cooldownEndsAt without waiting for the next response.
export function useBreakerState({ startResponse, onBatchResponse }: BreakerStateOptions): BreakerStateResult {
  const [fromServer, setFromServer] = useState<{ start: SessionStart | null; breaker: Breaker } | null>(null)
  const [expired, setExpired] = useState<string | null>(null)

  // The start response's breaker counts until a newer payload arrives for the same session.
  const current: Breaker =
    startResponse === null
      ? UNLOCKED
      : fromServer !== null && fromServer.start === startResponse
        ? fromServer.breaker
        : (parseBreaker(startResponse.breaker) ?? UNLOCKED)

  const apply = useCallback(
    (breaker: Breaker) => {
      setFromServer({ start: startResponse, breaker })
    },
    [startResponse],
  )

  useEffect(
    () =>
      onBatchResponse((response) => {
        const breaker = parseBreaker(response.breaker)
        if (breaker !== null) {
          apply(breaker)
        }
      }),
    [onBatchResponse, apply],
  )

  const cooldownEndsAt = current.state === 'COOLDOWN' ? current.cooldownEndsAt : null
  useEffect(() => {
    if (cooldownEndsAt === null) {
      return
    }
    const timer = setTimeout(() => setExpired(cooldownEndsAt), Math.max(0, Date.parse(cooldownEndsAt) - Date.now()))
    return () => clearTimeout(timer)
  }, [cooldownEndsAt])

  const shown: Breaker =
    current.state === 'COOLDOWN' && current.cooldownEndsAt === expired
      ? { ...UNLOCKED, reflectionMinLength: current.reflectionMinLength }
      : current

  return { ...shown, apply }
}
