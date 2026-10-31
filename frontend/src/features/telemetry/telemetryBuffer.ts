import type { BatchResponse, TelemetryEvent } from '../../api/sessionsApi.ts'

// Q4: send timing and batch size.
export const SEND_INTERVAL_MS = 10_000
export const MAX_BATCH_EVENTS = 200

// An event before the buffer gives it its clientEventId.
export type NewTelemetryEvent = TelemetryEvent extends infer E
  ? E extends TelemetryEvent
    ? Omit<E, 'clientEventId'>
    : never
  : never

export interface SendOptions {
  keepalive: boolean
}

export interface TelemetryBufferOptions {
  send: (events: TelemetryEvent[], options: SendOptions) => Promise<BatchResponse>
  // Called with every successful batch response, except those of close().
  onResponse?: (response: BatchResponse) => void
  // A batch the server will never accept (for example a 400) is dropped instead of retried forever.
  isPermanentFailure?: (error: unknown) => boolean
  newId?: () => string
  // Starts the periodic send; returns a function that stops it.
  setTimer?: (callback: () => void, ms: number) => () => void
}

export interface TelemetryBuffer {
  add(event: NewTelemetryEvent): void
  // Sends everything now, in batches of at most 200. Resolves with the last response, or null if a
  // send failed or there was nothing to send.
  flushNow(): Promise<BatchResponse | null>
  // Stops the timer and sends what is left without waiting for answers. Later adds are ignored.
  close(options: SendOptions): void
  size(): number
}

function intervalTimer(callback: () => void, ms: number): () => void {
  const id = setInterval(callback, ms)
  return () => clearInterval(id)
}

// Spec 17 R3. Events stay in memory only. A failed batch stays at the front with the same ids and
// is sent again next time; the server skips ids it already has (spec 18 R5). Sends run one at a time.
export function createTelemetryBuffer({
  send,
  onResponse,
  isPermanentFailure = () => false,
  newId = () => crypto.randomUUID(),
  setTimer = intervalTimer,
}: TelemetryBufferOptions): TelemetryBuffer {
  const events: TelemetryEvent[] = []
  // Events at the front of `events` that the current request is sending.
  let inFlight = 0
  let busy = 0
  let queue: Promise<unknown> = Promise.resolve()
  let closed = false

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    busy += 1
    const result = queue.then(operation).finally(() => {
      busy -= 1
    })
    queue = result.catch(() => undefined)
    return result
  }

  async function sendChunk(): Promise<BatchResponse | null> {
    const chunk = events.slice(0, MAX_BATCH_EVENTS)
    if (closed || chunk.length === 0) {
      return null
    }
    inFlight = chunk.length
    try {
      const response = await send(chunk, { keepalive: false })
      events.splice(0, chunk.length)
      if (!closed) {
        onResponse?.(response)
      }
      return response
    } catch (error: unknown) {
      if (isPermanentFailure(error)) {
        events.splice(0, chunk.length)
      }
      return null
    } finally {
      inFlight = 0
    }
  }

  const stopTimer = setTimer(() => {
    // A tick during a send waits for the next tick instead of queueing up behind it.
    if (busy === 0 && events.length > 0) {
      void enqueue(sendChunk)
    }
  }, SEND_INTERVAL_MS)

  function add(event: NewTelemetryEvent): void {
    if (!closed) {
      events.push({ ...event, clientEventId: newId() } as TelemetryEvent)
    }
  }

  function flushNow(): Promise<BatchResponse | null> {
    return enqueue(async () => {
      let last: BatchResponse | null = null
      while (!closed && events.length > 0) {
        const response = await sendChunk()
        if (response === null) {
          return null
        }
        last = response
      }
      return last
    })
  }

  function close({ keepalive }: SendOptions): void {
    if (closed) {
      return
    }
    closed = true
    stopTimer()
    const rest = events.splice(inFlight)
    for (let start = 0; start < rest.length; start += MAX_BATCH_EVENTS) {
      send(rest.slice(start, start + MAX_BATCH_EVENTS), { keepalive }).catch(() => undefined)
    }
  }

  return { add, flushNow, close, size: () => events.length }
}
