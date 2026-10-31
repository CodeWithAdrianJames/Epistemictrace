import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEditCoalescer, EDIT_COALESCE_MS, type CoalescedEdit } from './editCoalescer.ts'

const T0 = Date.parse('2026-11-03T02:15:00Z')

let emitted: CoalescedEdit[]

function coalescer() {
  emitted = []
  return createEditCoalescer((edit) => emitted.push(edit))
}

// The coalescer reads change.at, and its timer runs on the fake clock; keep both in step.
function at(offsetMs: number): number {
  vi.setSystemTime(T0 + offsetMs)
  return T0 + offsetMs
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createEditCoalescer', () => {
  it('sums changes less than 2 s apart into one edit with the time of the last change', () => {
    const edits = coalescer()
    edits.push({ charsAdded: 1, charsRemoved: 0, at: at(0) })
    vi.advanceTimersByTime(1500)
    edits.push({ charsAdded: 2, charsRemoved: 1, at: at(1500) })
    vi.advanceTimersByTime(1999)
    edits.push({ charsAdded: 3, charsRemoved: 0, at: at(3499) })

    expect(emitted).toEqual([])
    vi.advanceTimersByTime(EDIT_COALESCE_MS)

    expect(emitted).toEqual([{ charsAdded: 6, charsRemoved: 1, at: T0 + 3499 }])
  })

  it('emits the pending edit 2 s after its last change', () => {
    const edits = coalescer()
    edits.push({ charsAdded: 4, charsRemoved: 0, at: at(0) })

    vi.advanceTimersByTime(EDIT_COALESCE_MS - 1)
    expect(emitted).toEqual([])
    vi.advanceTimersByTime(1)

    expect(emitted).toEqual([{ charsAdded: 4, charsRemoved: 0, at: T0 }])
  })

  it('keeps changes 2 s or more apart as separate edits', () => {
    const edits = coalescer()
    edits.push({ charsAdded: 1, charsRemoved: 0, at: T0 })
    // The timer has not fired yet (no time advanced), but the change itself is 2 s later.
    edits.push({ charsAdded: 2, charsRemoved: 0, at: T0 + EDIT_COALESCE_MS })

    expect(emitted).toEqual([{ charsAdded: 1, charsRemoved: 0, at: T0 }])
    vi.advanceTimersByTime(EDIT_COALESCE_MS)
    expect(emitted).toEqual([
      { charsAdded: 1, charsRemoved: 0, at: T0 },
      { charsAdded: 2, charsRemoved: 0, at: T0 + EDIT_COALESCE_MS },
    ])
  })

  it('flush emits the pending edit at once and cancels its timer', () => {
    const edits = coalescer()
    edits.push({ charsAdded: 1, charsRemoved: 2, at: at(0) })

    edits.flush()
    expect(emitted).toEqual([{ charsAdded: 1, charsRemoved: 2, at: T0 }])

    vi.advanceTimersByTime(EDIT_COALESCE_MS * 2)
    expect(emitted).toHaveLength(1)
  })

  it('flush with nothing pending emits nothing', () => {
    const edits = coalescer()
    edits.flush()
    expect(emitted).toEqual([])
  })

  it('never emits an edit that adds and removes nothing', () => {
    const edits = coalescer()
    edits.push({ charsAdded: 0, charsRemoved: 0, at: at(0) })
    edits.flush()
    expect(emitted).toEqual([])
  })

  it('dispose drops the pending edit and its timer', () => {
    const edits = coalescer()
    edits.push({ charsAdded: 1, charsRemoved: 0, at: at(0) })

    edits.dispose()
    vi.advanceTimersByTime(EDIT_COALESCE_MS * 2)
    edits.flush()

    expect(emitted).toEqual([])
  })
})
