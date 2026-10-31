import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { BatchResponse } from '../../api/sessionsApi.ts'
import { useStruggleLevel } from './useStruggleLevel.ts'

function batchSource() {
  const listeners = new Set<(response: BatchResponse) => void>()
  return {
    onBatchResponse: (listener: (response: BatchResponse) => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    emit(fields: Record<string, unknown>) {
      act(() => {
        for (const listener of [...listeners]) listener({ accepted: 1, duplicates: 0, ...fields })
      })
    },
    size: () => listeners.size,
  }
}

describe('useStruggleLevel', () => {
  it('is null before the first scored run', () => {
    const source = batchSource()
    const { result } = renderHook(() => useStruggleLevel(source.onBatchResponse))
    expect(result.current).toBeNull()
  })

  it('follows the latest level from batch responses', () => {
    const source = batchSource()
    const { result } = renderHook(() => useStruggleLevel(source.onBatchResponse))

    source.emit({ struggleLevel: 'LOW' })
    expect(result.current).toBe('LOW')
    source.emit({ struggleLevel: 'HIGH' })
    expect(result.current).toBe('HIGH')
    source.emit({ struggleLevel: 'MEDIUM' })
    expect(result.current).toBe('MEDIUM')
  })

  it('keeps the last level when a batch has no run (null) or an unknown value', () => {
    const source = batchSource()
    const { result } = renderHook(() => useStruggleLevel(source.onBatchResponse))
    source.emit({ struggleLevel: 'MEDIUM' })

    source.emit({ struggleLevel: null })
    source.emit({})
    source.emit({ struggleLevel: 'EXTREME' })
    source.emit({ struggleLevel: 72 })
    source.emit({ struggleLevel: 'low' })

    expect(result.current).toBe('MEDIUM')
  })

  it('unsubscribes on unmount', () => {
    const source = batchSource()
    const { unmount } = renderHook(() => useStruggleLevel(source.onBatchResponse))
    expect(source.size()).toBe(1)
    unmount()
    expect(source.size()).toBe(0)
  })
})
