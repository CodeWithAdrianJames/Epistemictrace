import { useCallback, useEffect, useRef, useState } from 'react'
import type { BatchResponse } from '../../api/sessionsApi.ts'
import type { RunReport } from '../runner/runTests.ts'

// Spec 23 R2 (Q2): how long Run tests waits for the server's answer to a run before failing open.
export const SERVER_WAIT_MS = 5000

export const SERVER_UNREACHABLE_MESSAGE =
  "We couldn't reach the server. Your tests still run, but pauses may not work right now."

export interface RunGate {
  // True from the end of a run until the server answers it or SERVER_WAIT_MS pass.
  waiting: boolean
  // True when the last tracked run got no answer; cleared by the next answered run.
  unreachable: boolean
  // Pass every finished run here; it records the run and waits for the answer when tracking is on.
  handleReport(report: RunReport): void
}

// Spec 23 R2: keep Run tests disabled until recordRun resolves or 5 s pass, whichever is first.
// Without tracking (no session) a run is not gated: there is no answer to wait for.
export function useRunGate(recordRun: (report: RunReport) => Promise<BatchResponse | null>, tracking: boolean): RunGate {
  const [waiting, setWaiting] = useState(false)
  const [unreachable, setUnreachable] = useState(false)
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const handleReport = useCallback(
    (report: RunReport) => {
      const recorded = recordRun(report)
      if (!tracking || report.status === 'unavailable' || report.totalCount < 1) {
        return
      }
      setWaiting(true)
      let timer: ReturnType<typeof setTimeout> | undefined
      const timeout = new Promise<'timeout'>((resolve) => {
        timer = setTimeout(() => resolve('timeout'), SERVER_WAIT_MS)
      })
      void Promise.race([recorded, timeout]).then((result) => {
        clearTimeout(timer)
        if (!mountedRef.current) return
        setWaiting(false)
        setUnreachable(result === 'timeout' || result === null)
      })
    },
    [recordRun, tracking],
  )

  return { waiting, unreachable, handleReport }
}
