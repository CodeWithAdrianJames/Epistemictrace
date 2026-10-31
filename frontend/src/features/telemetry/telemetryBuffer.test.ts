import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BatchResponse, TelemetryEvent } from '../../api/sessionsApi.ts'
import {
  createTelemetryBuffer,
  MAX_BATCH_EVENTS,
  SEND_INTERVAL_MS,
  type SendOptions,
  type TelemetryBufferOptions,
} from './telemetryBuffer.ts'

const AT = '2026-11-03T02:15:04.120Z'

interface Deferred {
  resolve: (response: BatchResponse) => void
  reject: (error: unknown) => void
}

let sent: { events: TelemetryEvent[]; options: SendOptions }[]
let pending: Deferred[]
let send: ReturnType<typeof vi.fn<TelemetryBufferOptions['send']>>
let nextId: number

// Each send stays open until the test answers it, so in-flight behaviour can be checked step by step.
function manualSend(): void {
  send = vi.fn(
    (events: TelemetryEvent[], options: SendOptions) =>
      new Promise<BatchResponse>((resolve, reject) => {
        sent.push({ events, options })
        pending.push({ resolve, reject })
      }),
  )
}

function autoSend(): void {
  send = vi.fn(async (events: TelemetryEvent[], options: SendOptions) => {
    sent.push({ events, options })
    return { accepted: events.length, duplicates: 0 }
  })
}

function buffer(options: Partial<TelemetryBufferOptions> = {}) {
  return createTelemetryBuffer({ send, newId: () => `id-${(nextId += 1)}`, ...options })
}

function edit(chars = 1) {
  return { type: 'EDIT' as const, occurredAt: AT, charsAdded: chars, charsRemoved: 0 }
}

async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0)
}

beforeEach(() => {
  vi.useFakeTimers()
  sent = []
  pending = []
  nextId = 0
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createTelemetryBuffer', () => {
  it('gives each event a clientEventId and keeps the payload fields', async () => {
    autoSend()
    const events = buffer()
    events.add(edit(3))
    events.add({ type: 'ERROR', occurredAt: AT, errorSignature: 'NameError@3' })
    events.add({ type: 'RUN', occurredAt: AT, passedCount: 1, totalCount: 4 })

    await events.flushNow()

    expect(sent[0].events).toEqual([
      { type: 'EDIT', occurredAt: AT, charsAdded: 3, charsRemoved: 0, clientEventId: 'id-1' },
      { type: 'ERROR', occurredAt: AT, errorSignature: 'NameError@3', clientEventId: 'id-2' },
      { type: 'RUN', occurredAt: AT, passedCount: 1, totalCount: 4, clientEventId: 'id-3' },
    ])
  })

  it('uses crypto.randomUUID by default', async () => {
    autoSend()
    const events = createTelemetryBuffer({ send })
    events.add(edit())
    await events.flushNow()
    expect(sent[0].events[0].clientEventId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('sends every 10 s when there are events, and not when empty', async () => {
    autoSend()
    const events = buffer()

    await vi.advanceTimersByTimeAsync(SEND_INTERVAL_MS)
    expect(send).not.toHaveBeenCalled()

    events.add(edit())
    await vi.advanceTimersByTimeAsync(SEND_INTERVAL_MS - 1)
    expect(send).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)

    expect(sent).toEqual([{ events: [expect.objectContaining({ clientEventId: 'id-1' })], options: { keepalive: false } }])
    expect(events.size()).toBe(0)
  })

  it('a periodic send takes at most 200 events', async () => {
    autoSend()
    const events = buffer()
    for (let i = 0; i < MAX_BATCH_EVENTS + 5; i += 1) events.add(edit())

    await vi.advanceTimersByTimeAsync(SEND_INTERVAL_MS)

    expect(sent).toHaveLength(1)
    expect(sent[0].events).toHaveLength(MAX_BATCH_EVENTS)
    expect(events.size()).toBe(5)
  })

  it('flushNow sends everything in chunks of 200 and resolves with the last response', async () => {
    autoSend()
    const events = buffer()
    for (let i = 0; i < 450; i += 1) events.add(edit())

    const response = await events.flushNow()

    expect(sent.map((batch) => batch.events.length)).toEqual([200, 200, 50])
    expect(response).toEqual({ accepted: 50, duplicates: 0 })
    expect(events.size()).toBe(0)
  })

  it('flushNow with nothing buffered sends nothing and resolves null', async () => {
    autoSend()
    await expect(buffer().flushNow()).resolves.toBeNull()
    expect(send).not.toHaveBeenCalled()
  })

  it('passes every successful response to onResponse', async () => {
    autoSend()
    const onResponse = vi.fn()
    const events = buffer({ onResponse })
    events.add(edit())
    await events.flushNow()
    events.add(edit())
    await vi.advanceTimersByTimeAsync(SEND_INTERVAL_MS)

    expect(onResponse.mock.calls).toEqual([[{ accepted: 1, duplicates: 0 }], [{ accepted: 1, duplicates: 0 }]])
  })

  it('a failed send keeps the events in front with the same ids and retries them', async () => {
    manualSend()
    const events = buffer()
    events.add(edit())
    events.add(edit())

    const first = events.flushNow()
    await settle()
    events.add(edit())
    pending[0].reject(new Error('offline'))
    await expect(first).resolves.toBeNull()
    expect(events.size()).toBe(3)

    const second = events.flushNow()
    await settle()
    expect(sent[1].events.map((event) => event.clientEventId)).toEqual(['id-1', 'id-2', 'id-3'])
    pending[1].resolve({ accepted: 3, duplicates: 0 })
    await expect(second).resolves.toEqual({ accepted: 3, duplicates: 0 })
    expect(events.size()).toBe(0)
  })

  it('drops a batch the server will never accept', async () => {
    manualSend()
    const events = buffer({ isPermanentFailure: (error) => error === 'bad request' })
    events.add(edit())

    const flush = events.flushNow()
    await settle()
    pending[0].reject('bad request')

    await expect(flush).resolves.toBeNull()
    expect(events.size()).toBe(0)
  })

  it('keeps one request in flight and runs a flush requested meanwhile right after it', async () => {
    manualSend()
    const events = buffer()
    events.add(edit())
    const first = events.flushNow()
    await settle()

    events.add(edit())
    const second = events.flushNow()
    await vi.advanceTimersByTimeAsync(SEND_INTERVAL_MS)
    expect(send).toHaveBeenCalledTimes(1)

    // The running flush also sends what was added while it waited; the queued one then finds nothing.
    pending[0].resolve({ accepted: 1, duplicates: 0 })
    await settle()
    expect(send).toHaveBeenCalledTimes(2)
    expect(sent[1].events.map((event) => event.clientEventId)).toEqual(['id-2'])

    pending[1].resolve({ accepted: 1, duplicates: 7 })
    await expect(first).resolves.toEqual({ accepted: 1, duplicates: 7 })
    await expect(second).resolves.toBeNull()
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('a flush requested during a periodic send runs right after it', async () => {
    manualSend()
    const events = buffer()
    events.add(edit())
    await vi.advanceTimersByTimeAsync(SEND_INTERVAL_MS)
    expect(send).toHaveBeenCalledTimes(1)

    events.add(edit())
    const flush = events.flushNow()
    await settle()
    expect(send).toHaveBeenCalledTimes(1)

    pending[0].resolve({ accepted: 1, duplicates: 0 })
    await settle()
    expect(sent[1].events.map((event) => event.clientEventId)).toEqual(['id-2'])
    pending[1].resolve({ accepted: 1, duplicates: 0 })
    await expect(flush).resolves.toEqual({ accepted: 1, duplicates: 0 })
  })

  it('close stops the timer and sends what is left with keepalive', async () => {
    autoSend()
    const onResponse = vi.fn()
    const events = buffer({ onResponse })
    for (let i = 0; i < MAX_BATCH_EVENTS + 1; i += 1) events.add(edit())

    events.close({ keepalive: true })
    await settle()

    expect(sent.map((batch) => [batch.events.length, batch.options])).toEqual([
      [MAX_BATCH_EVENTS, { keepalive: true }],
      [1, { keepalive: true }],
    ])
    expect(onResponse).not.toHaveBeenCalled()

    events.add(edit())
    await vi.advanceTimersByTimeAsync(SEND_INTERVAL_MS * 3)
    await expect(events.flushNow()).resolves.toBeNull()
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('close does not resend the events of the request in flight', async () => {
    manualSend()
    const events = buffer()
    events.add(edit())
    void events.flushNow()
    await settle()
    events.add(edit())

    events.close({ keepalive: true })

    expect(sent[1]).toEqual({ events: [expect.objectContaining({ clientEventId: 'id-2' })], options: { keepalive: true } })
    pending[0].resolve({ accepted: 1, duplicates: 0 })
    pending[1].resolve({ accepted: 1, duplicates: 0 })
    await settle()
    expect(send).toHaveBeenCalledTimes(2)
  })
})
