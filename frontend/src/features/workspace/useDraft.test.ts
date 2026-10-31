import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDraft } from './useDraft.ts'

const STARTER = 'def solve():\n    pass\n'

function stored(userId: string | number, activityId: string | number): string | null {
  return localStorage.getItem(`epistemictrace:draft:${userId}:${activityId}`)
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  localStorage.clear()
})

interface HookProps {
  userId: string | number
  activityId: string | number
  starterCode: string
}

function renderDraft(props: HookProps) {
  return renderHook(({ userId, activityId, starterCode }: HookProps) => useDraft(userId, activityId, starterCode), {
    initialProps: props,
  })
}

describe('useDraft', () => {
  it('starts from the starter code when no draft is saved', () => {
    const { result } = renderDraft({ userId: 7, activityId: 3, starterCode: STARTER })

    expect(result.current[0]).toBe(STARTER)
  })

  it('starts from the saved draft when one exists, even if it differs from the starter', () => {
    localStorage.setItem('epistemictrace:draft:7:3', 'print("saved")')

    const { result } = renderDraft({ userId: 7, activityId: 3, starterCode: STARTER })

    expect(result.current[0]).toBe('print("saved")')
  })

  it('treats a saved empty draft as a draft', () => {
    localStorage.setItem('epistemictrace:draft:7:3', '')

    const { result } = renderDraft({ userId: 7, activityId: 3, starterCode: STARTER })

    expect(result.current[0]).toBe('')
  })

  it('does not save anything until the code changes', () => {
    const { unmount } = renderDraft({ userId: 7, activityId: 3, starterCode: STARTER })

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    window.dispatchEvent(new Event('pagehide'))
    unmount()

    expect(stored(7, 3)).toBeNull()
  })

  it('updates the code at once but saves it only after 500 ms', () => {
    const { result } = renderDraft({ userId: 7, activityId: 3, starterCode: STARTER })

    act(() => {
      result.current[1]('x = 1')
    })

    expect(result.current[0]).toBe('x = 1')
    act(() => {
      vi.advanceTimersByTime(499)
    })
    expect(stored(7, 3)).toBeNull()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(stored(7, 3)).toBe('x = 1')
  })

  it('restarts the 500 ms delay on every change and saves only the latest code', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const { result } = renderDraft({ userId: 7, activityId: 3, starterCode: STARTER })

    act(() => {
      result.current[1]('x')
    })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    act(() => {
      result.current[1]('x =')
    })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    act(() => {
      result.current[1]('x = 1')
    })
    act(() => {
      vi.advanceTimersByTime(499)
    })

    expect(stored(7, 3)).toBeNull()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(stored(7, 3)).toBe('x = 1')
    expect(setItem).toHaveBeenCalledTimes(1)
  })

  it('saves the pending code at once on pagehide', () => {
    const { result } = renderDraft({ userId: 7, activityId: 3, starterCode: STARTER })

    act(() => {
      result.current[1]('x = 1')
    })
    window.dispatchEvent(new Event('pagehide'))

    expect(stored(7, 3)).toBe('x = 1')
  })

  it('does not save a second time when the timer fires after a pagehide flush', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const { result } = renderDraft({ userId: 7, activityId: 3, starterCode: STARTER })

    act(() => {
      result.current[1]('x = 1')
    })
    window.dispatchEvent(new Event('pagehide'))
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(setItem).toHaveBeenCalledTimes(1)
  })

  it('saves the pending code at once on unmount', () => {
    const { result, unmount } = renderDraft({ userId: 7, activityId: 3, starterCode: STARTER })

    act(() => {
      result.current[1]('x = 1')
    })
    unmount()

    expect(stored(7, 3)).toBe('x = 1')
  })

  it('stops listening for pagehide after unmount', () => {
    const { result, unmount } = renderDraft({ userId: 7, activityId: 3, starterCode: STARTER })
    act(() => {
      result.current[1]('x = 1')
    })
    unmount()
    localStorage.clear()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    window.dispatchEvent(new Event('pagehide'))
    vi.advanceTimersByTime(1000)

    expect(setItem).not.toHaveBeenCalled()
  })

  it('returns a setter that keeps its identity across renders', () => {
    const { result, rerender } = renderDraft({ userId: 7, activityId: 3, starterCode: STARTER })
    const first = result.current[1]

    act(() => {
      result.current[1]('x = 1')
    })
    rerender({ userId: 7, activityId: 3, starterCode: STARTER })

    expect(result.current[1]).toBe(first)
  })

  it('switches to the other activity draft and saves the pending code under the old activity', () => {
    localStorage.setItem('epistemictrace:draft:7:4', 'activity four')
    const { result, rerender } = renderDraft({ userId: 7, activityId: 3, starterCode: STARTER })

    act(() => {
      result.current[1]('activity three')
    })
    rerender({ userId: 7, activityId: 4, starterCode: STARTER })

    expect(result.current[0]).toBe('activity four')
    expect(stored(7, 3)).toBe('activity three')
    expect(stored(7, 4)).toBe('activity four')
  })

  it('saves changes made after switching activity under the new activity only', () => {
    const { result, rerender } = renderDraft({ userId: 7, activityId: 3, starterCode: STARTER })
    rerender({ userId: 7, activityId: 4, starterCode: 'starter four' })

    expect(result.current[0]).toBe('starter four')
    act(() => {
      result.current[1]('edited four')
    })
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(stored(7, 4)).toBe('edited four')
    expect(stored(7, 3)).toBeNull()
  })

  it('keeps working in memory when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })
    const { result, unmount } = renderDraft({ userId: 7, activityId: 3, starterCode: STARTER })

    expect(result.current[0]).toBe(STARTER)
    act(() => {
      result.current[1]('x = 1')
    })
    expect(result.current[0]).toBe('x = 1')
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(500)
      })
    }).not.toThrow()
    expect(result.current[0]).toBe('x = 1')
    expect(() => unmount()).not.toThrow()
  })
})
