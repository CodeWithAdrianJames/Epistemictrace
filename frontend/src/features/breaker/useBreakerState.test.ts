import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BatchResponse, Breaker, SessionStart } from '../../api/sessionsApi.ts'
import { UNLOCKED, useBreakerState, type BreakerStateOptions } from './useBreakerState.ts'

const T0 = Date.parse('2026-11-03T02:00:00Z')

const LOCKED: Breaker = { state: 'LOCKED', cooldownEndsAt: null, reflectionMinLength: 20 }

function start(breaker?: unknown): SessionStart {
  return { sessionId: 5, activityId: 42, startedAt: '2026-11-03T02:00:00Z', resumed: false, breaker }
}

// A stand-in for useTelemetrySession's onBatchResponse: tests push responses with emit().
function batchSource() {
  const listeners = new Set<(response: BatchResponse) => void>()
  return {
    onBatchResponse: (listener: (response: BatchResponse) => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    emit(response: Record<string, unknown>) {
      act(() => {
        for (const listener of [...listeners]) listener({ accepted: 1, duplicates: 0, ...response })
      })
    },
    size: () => listeners.size,
  }
}

function renderBreaker(startResponse: SessionStart | null, source = batchSource()) {
  const hook = renderHook((props: BreakerStateOptions) => useBreakerState(props), {
    initialProps: { startResponse, onBatchResponse: source.onBatchResponse },
  })
  return { ...hook, source }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useBreakerState', () => {
  it('is UNLOCKED while tracking is off', () => {
    const { result, source } = renderBreaker(null)
    source.emit({ breaker: LOCKED })
    expect(result.current).toMatchObject(UNLOCKED)
  })

  it('starts from the session start response', () => {
    const { result } = renderBreaker(start(LOCKED))
    expect(result.current).toMatchObject(LOCKED)
  })

  it('is UNLOCKED when the start response has no valid breaker', () => {
    expect(renderBreaker(start()).result.current).toMatchObject(UNLOCKED)
    expect(renderBreaker(start({ state: 'PAUSED', reflectionMinLength: 20 })).result.current).toMatchObject(UNLOCKED)
  })

  it('follows every batch response that has a valid breaker', () => {
    const { result, source } = renderBreaker(start({ ...UNLOCKED, reflectionMinLength: 20 }))

    source.emit({ breaker: LOCKED })
    expect(result.current.state).toBe('LOCKED')

    source.emit({ breaker: { state: 'UNLOCKED', cooldownEndsAt: null, reflectionMinLength: 20 } })
    expect(result.current.state).toBe('UNLOCKED')
  })

  it('ignores batch responses without a valid breaker', () => {
    const { result, source } = renderBreaker(start(LOCKED))

    source.emit({})
    source.emit({ breaker: null })
    source.emit({ breaker: { state: 'COOLDOWN', cooldownEndsAt: 'soon', reflectionMinLength: 20 } })
    source.emit({ breaker: { state: 'UNLOCKED', cooldownEndsAt: null, reflectionMinLength: 0 } })

    expect(result.current).toMatchObject(LOCKED)
  })

  it('switches COOLDOWN to UNLOCKED at cooldownEndsAt', () => {
    const end = new Date(T0 + 60_000).toISOString()
    const { result } = renderBreaker(start({ state: 'COOLDOWN', cooldownEndsAt: end, reflectionMinLength: 20 }))
    expect(result.current.state).toBe('COOLDOWN')

    act(() => vi.advanceTimersByTime(59_999))
    expect(result.current.state).toBe('COOLDOWN')
    act(() => vi.advanceTimersByTime(1))

    expect(result.current).toMatchObject({ state: 'UNLOCKED', cooldownEndsAt: null, reflectionMinLength: 20 })
  })

  it('a cooldown further away than the longest timer stays COOLDOWN', () => {
    const end = '2099-01-01T00:00:00Z'
    const { result } = renderBreaker(start({ state: 'COOLDOWN', cooldownEndsAt: end, reflectionMinLength: 20 }))
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.state).toBe('COOLDOWN')
  })

  it('a cooldown that already ended shows UNLOCKED straight away', () => {
    const end = new Date(T0 - 1000).toISOString()
    const { result } = renderBreaker(start({ state: 'COOLDOWN', cooldownEndsAt: end, reflectionMinLength: 20 }))
    act(() => vi.advanceTimersByTime(0))
    expect(result.current.state).toBe('UNLOCKED')
  })

  it('apply sets the state from a payload sent outside a batch', () => {
    const { result } = renderBreaker(start(LOCKED))
    const end = new Date(T0 + 600_000).toISOString()

    act(() => result.current.apply({ state: 'COOLDOWN', cooldownEndsAt: end, reflectionMinLength: 20 }))

    expect(result.current).toMatchObject({ state: 'COOLDOWN', cooldownEndsAt: end })
  })

  it('a new session start replaces state from the previous session', () => {
    const { result, source, rerender } = renderBreaker(start(LOCKED))
    source.emit({ breaker: LOCKED })

    rerender({ startResponse: { ...start(), breaker: { ...UNLOCKED, reflectionMinLength: 20 } }, onBatchResponse: source.onBatchResponse })

    expect(result.current.state).toBe('UNLOCKED')
  })

  it('unsubscribes from batch responses on unmount', () => {
    const { unmount, source } = renderBreaker(start(LOCKED))
    expect(source.size()).toBe(1)
    unmount()
    expect(source.size()).toBe(0)
  })
})
