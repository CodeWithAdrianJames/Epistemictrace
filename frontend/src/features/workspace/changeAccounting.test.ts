import { describe, expect, it } from 'vitest'
import { countChange } from './changeAccounting.ts'

describe('countChange', () => {
  it('counts nothing for an event without changes', () => {
    expect(countChange([])).toEqual({ charsAdded: 0, charsRemoved: 0 })
  })

  it('counts one typed character as one added', () => {
    expect(countChange([{ text: 'a', rangeLength: 0 }])).toEqual({ charsAdded: 1, charsRemoved: 0 })
  })

  it('counts a paste as the length of the pasted text', () => {
    expect(countChange([{ text: 'print("hello")\n', rangeLength: 0 }])).toEqual({ charsAdded: 15, charsRemoved: 0 })
  })

  it('counts a new line with auto-indent as every inserted character', () => {
    expect(countChange([{ text: '\n    ', rangeLength: 0 }])).toEqual({ charsAdded: 5, charsRemoved: 0 })
  })

  it('counts a backspace as one removed', () => {
    expect(countChange([{ text: '', rangeLength: 1 }])).toEqual({ charsAdded: 0, charsRemoved: 1 })
  })

  it('counts deleting a selection as its length removed', () => {
    expect(countChange([{ text: '', rangeLength: 12 }])).toEqual({ charsAdded: 0, charsRemoved: 12 })
  })

  it('counts typing one character over a 5-character selection as +1 / -5', () => {
    expect(countChange([{ text: 'x', rangeLength: 5 }])).toEqual({ charsAdded: 1, charsRemoved: 5 })
  })

  it('sums every change of a multi-cursor edit', () => {
    const changes = [
      { text: 'x', rangeLength: 0 },
      { text: 'x', rangeLength: 0 },
      { text: 'x', rangeLength: 3 },
    ]

    expect(countChange(changes)).toEqual({ charsAdded: 3, charsRemoved: 3 })
  })

  it('sums a multi-cursor delete', () => {
    const changes = [
      { text: '', rangeLength: 1 },
      { text: '', rangeLength: 1 },
    ]

    expect(countChange(changes)).toEqual({ charsAdded: 0, charsRemoved: 2 })
  })

  it('counts an undo that restores replaced text the other way round', () => {
    expect(countChange([{ text: 'hello', rangeLength: 1 }])).toEqual({ charsAdded: 5, charsRemoved: 1 })
  })

  it('counts in UTF-16 code units, the unit Monaco uses for rangeLength', () => {
    expect(countChange([{ text: '😀', rangeLength: 2 }])).toEqual({ charsAdded: 2, charsRemoved: 2 })
  })

  it('ignores extra fields that Monaco sends with each change', () => {
    const change = {
      text: 'ab',
      rangeLength: 1,
      rangeOffset: 10,
      range: { startLineNumber: 1, startColumn: 11, endLineNumber: 1, endColumn: 12 },
    }

    expect(countChange([change])).toEqual({ charsAdded: 2, charsRemoved: 1 })
  })
})
