import { useEffect, useState } from 'react'
import type { BatchResponse } from '../../api/sessionsApi.ts'

export type StruggleLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export type BatchResponseRegistration = (listener: (response: BatchResponse) => void) => () => void

function isStruggleLevel(value: unknown): value is StruggleLevel {
  return value === 'LOW' || value === 'MEDIUM' || value === 'HIGH'
}

// Spec 28 R1, R2: the latest level the server sent with a batch (spec 21 R4); null before the first
// scored run of the visit and whenever tracking is off (no responses arrive then). The client never
// computes a level (R4).
export function useStruggleLevel(onBatchResponse: BatchResponseRegistration): StruggleLevel | null {
  const [level, setLevel] = useState<StruggleLevel | null>(null)

  useEffect(
    () =>
      onBatchResponse((response) => {
        if (isStruggleLevel(response.struggleLevel)) {
          setLevel(response.struggleLevel)
        }
      }),
    [onBatchResponse],
  )

  return level
}
