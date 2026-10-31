import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/ApiError.ts'
import { endSession, sendEvents, startSession, type BatchResponse, type SessionStart } from '../../api/sessionsApi.ts'
import { useProtectedRequest } from '../../auth/useProtectedRequest.ts'
import type { ConsentStatus } from '../consent/useConsent.ts'
import type { RunReport } from '../runner/runTests.ts'
import type { EditorChange } from '../workspace/CodeEditor.tsx'
import { createEditCoalescer, type EditCoalescer } from './editCoalescer.ts'
import { createTelemetryBuffer, type TelemetryBuffer } from './telemetryBuffer.ts'

export const TRACKING_UNAVAILABLE_MESSAGE = 'Tracking is unavailable right now.'

export type BatchListener = (response: BatchResponse) => void

export interface TelemetrySession {
  sessionId: number | null
  startResponse: SessionStart | null
  // True when starting the session failed; tracking stays off for this visit (no retries).
  unavailable: boolean
  recordEdit(change: EditorChange): void
  // Resolves with the response to the batch that carried the RUN, or null when nothing was sent or sending failed.
  recordRun(report: RunReport): Promise<BatchResponse | null>
  // Every batch response goes to these listeners (specs 23 and 28). Returns an unsubscribe function.
  onBatchResponse(listener: BatchListener): () => void
}

export interface TelemetrySessionOptions {
  activityId: number
  consentStatus: ConsentStatus
}

interface Tracker {
  coalescer: EditCoalescer
  buffer: TelemetryBuffer
  // Flushes the pending edit, sends what is left with keepalive and ends the session. Runs once.
  stop(): void
}

interface SessionState {
  sessionId: number | null
  startResponse: SessionStart | null
  unavailable: boolean
}

const IDLE: SessionState = { sessionId: null, startResponse: null, unavailable: false }

// A rejected batch (400 invalid, 403/404 not this student's session, 401 logged out) would fail
// the same way on every retry, so it is dropped instead of blocking the events behind it.
function isPermanentFailure(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429
}

function isoTime(ms: number): string {
  return new Date(ms).toISOString()
}

// Spec 17 R4. Used only by WorkspacePage. Nothing is captured unless consent is 'accepted' (invariant 2).
// recordEdit, recordRun and onBatchResponse keep their identity, so callers can use them in effects.
export function useTelemetrySession({ activityId, consentStatus }: TelemetrySessionOptions): TelemetrySession {
  const request = useProtectedRequest()
  const requestRef = useRef(request)
  const trackerRef = useRef<Tracker | null>(null)
  const listenersRef = useRef(new Set<BatchListener>())
  const [state, setState] = useState<SessionState>(IDLE)
  const accepted = consentStatus === 'accepted'

  useEffect(() => {
    requestRef.current = request
  }, [request])

  useEffect(() => {
    if (!accepted) {
      return
    }
    const controller = new AbortController()
    let tracker: Tracker | null = null

    function createTracker(sessionId: number): Tracker {
      const buffer = createTelemetryBuffer({
        send: (events, { keepalive }) =>
          requestRef.current((token) => sendEvents(token, sessionId, events, { keepalive })),
        onResponse: (response) => {
          for (const listener of [...listenersRef.current]) {
            listener(response)
          }
        },
        isPermanentFailure,
      })
      const coalescer = createEditCoalescer((edit) => {
        buffer.add({ type: 'EDIT', occurredAt: isoTime(edit.at), charsAdded: edit.charsAdded, charsRemoved: edit.charsRemoved })
      })
      let stopped = false
      return {
        coalescer,
        buffer,
        stop() {
          if (stopped) return
          stopped = true
          coalescer.flush()
          buffer.close({ keepalive: true })
          requestRef.current((token) => endSession(token, sessionId, { keepalive: true })).catch(() => undefined)
        },
      }
    }

    function handlePageHide(): void {
      tracker?.stop()
    }

    requestRef.current((token) => startSession(token, activityId, controller.signal)).then(
      (start) => {
        if (controller.signal.aborted) return
        tracker = createTracker(start.sessionId)
        trackerRef.current = tracker
        window.addEventListener('pagehide', handlePageHide)
        setState({ sessionId: start.sessionId, startResponse: start, unavailable: false })
      },
      () => {
        if (controller.signal.aborted) return
        setState({ ...IDLE, unavailable: true })
      },
    )

    return () => {
      controller.abort()
      window.removeEventListener('pagehide', handlePageHide)
      tracker?.stop()
      trackerRef.current = null
    }
  }, [activityId, accepted])

  const recordEdit = useCallback((change: EditorChange) => {
    trackerRef.current?.coalescer.push(change)
  }, [])

  const recordRun = useCallback(async (report: RunReport): Promise<BatchResponse | null> => {
    const tracker = trackerRef.current
    // An unavailable runner ran nothing; a run without tests cannot be a valid RUN (spec 18 R2).
    if (tracker === null || report.status === 'unavailable' || report.totalCount < 1) {
      return null
    }
    // The last EDIT goes before the RUN it led to.
    tracker.coalescer.flush()
    const occurredAt = isoTime(report.finishedAt)
    if (report.errorSignature !== null) {
      tracker.buffer.add({ type: 'ERROR', occurredAt, errorSignature: report.errorSignature })
    }
    tracker.buffer.add({ type: 'RUN', occurredAt, passedCount: report.passedCount, totalCount: report.totalCount })
    return tracker.buffer.flushNow()
  }, [])

  const onBatchResponse = useCallback((listener: BatchListener) => {
    const listeners = listenersRef.current
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  return { ...state, recordEdit, recordRun, onBatchResponse }
}
