import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearDraft, loadDraft, saveDraft } from './draftStore.ts'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  sessionStorage.clear()
})

function throwingStorage(): void {
  const denied = () => {
    throw new DOMException('The operation is insecure.', 'SecurityError')
  }
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(denied)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(denied)
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(denied)
}

describe('draftStore', () => {
  it('returns null when no draft is stored', () => {
    expect(loadDraft(7, 3)).toBeNull()
  })

  it('round-trips a saved draft', () => {
    saveDraft(7, 3, 'print("hi")\n')

    expect(loadDraft(7, 3)).toBe('print("hi")\n')
  })

  it('stores the draft in localStorage under epistemictrace:draft:{userId}:{activityId}', () => {
    saveDraft(7, 3, 'x = 1')

    expect(localStorage.getItem('epistemictrace:draft:7:3')).toBe('x = 1')
  })

  it('accepts string ids, such as the local fallback user and a route parameter', () => {
    saveDraft('local', '12', 'y = 2')

    expect(localStorage.getItem('epistemictrace:draft:local:12')).toBe('y = 2')
    expect(loadDraft('local', '12')).toBe('y = 2')
  })

  it('keeps an empty draft distinct from no draft', () => {
    saveDraft(7, 3, '')

    expect(loadDraft(7, 3)).toBe('')
  })

  it('overwrites the previous draft for the same user and activity', () => {
    saveDraft(7, 3, 'first')
    saveDraft(7, 3, 'second')

    expect(loadDraft(7, 3)).toBe('second')
  })

  it('keeps drafts for different activities apart', () => {
    saveDraft(7, 3, 'activity three')
    saveDraft(7, 4, 'activity four')

    expect(loadDraft(7, 3)).toBe('activity three')
    expect(loadDraft(7, 4)).toBe('activity four')
  })

  it('keeps drafts for different users apart', () => {
    saveDraft(7, 3, 'user seven')
    saveDraft(8, 3, 'user eight')

    expect(loadDraft(7, 3)).toBe('user seven')
    expect(loadDraft(8, 3)).toBe('user eight')
  })

  it('does not confuse ids whose joined text would otherwise collide', () => {
    saveDraft(1, 23, 'one / twenty-three')
    saveDraft(12, 3, 'twelve / three')

    expect(loadDraft(1, 23)).toBe('one / twenty-three')
    expect(loadDraft(12, 3)).toBe('twelve / three')
  })

  it('clears only the draft for the given user and activity', () => {
    saveDraft(7, 3, 'keep me out')
    saveDraft(7, 4, 'keep me')

    clearDraft(7, 3)

    expect(loadDraft(7, 3)).toBeNull()
    expect(loadDraft(7, 4)).toBe('keep me')
  })

  it('does not use sessionStorage', () => {
    saveDraft(7, 3, 'x = 1')

    expect(sessionStorage.length).toBe(0)
  })

  it('returns null when reading storage throws', () => {
    throwingStorage()

    expect(loadDraft(7, 3)).toBeNull()
  })

  it('swallows errors when writing or clearing storage throws', () => {
    throwingStorage()

    expect(() => saveDraft(7, 3, 'x = 1')).not.toThrow()
    expect(() => clearDraft(7, 3)).not.toThrow()
  })

  it('swallows a quota error on save', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    })

    expect(() => saveDraft(7, 3, 'x = 1')).not.toThrow()
  })

  it('swallows errors when the localStorage property itself throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })

    expect(loadDraft(7, 3)).toBeNull()
    expect(() => saveDraft(7, 3, 'x = 1')).not.toThrow()
    expect(() => clearDraft(7, 3)).not.toThrow()
  })
})
