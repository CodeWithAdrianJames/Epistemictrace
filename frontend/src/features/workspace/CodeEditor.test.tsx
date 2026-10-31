import Editor, { type EditorProps, type OnChange } from '@monaco-editor/react'
import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CodeEditor from './CodeEditor.tsx'

// Monaco needs a real browser (and loads from a CDN), so the wrapper is replaced by a spy on its props.
vi.mock('@monaco-editor/react', () => ({
  default: vi.fn(() => null),
}))

const EditorMock = vi.mocked(Editor)

type ContentChangedEvent = Parameters<OnChange>[1]

const NOW = new Date('2026-10-31T09:00:00Z')

function contentChanged(changes: { text: string; rangeLength: number }[]): ContentChangedEvent {
  return { changes } as unknown as ContentChangedEvent
}

function lastProps(): EditorProps {
  const call = EditorMock.mock.lastCall
  if (!call) {
    throw new Error('Editor was not rendered')
  }
  return call[0]
}

function emit(value: string | undefined, changes: { text: string; rangeLength: number }[]): void {
  const onChange = lastProps().onChange
  if (!onChange) {
    throw new Error('Editor has no onChange')
  }
  onChange(value, contentChanged(changes))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
  vi.resetAllMocks()
})

describe('CodeEditor', () => {
  it('renders a Python editor with the light vs theme', () => {
    render(<CodeEditor value="" onChange={vi.fn()} />)

    expect(lastProps()).toMatchObject({ language: 'python', theme: 'vs' })
  })

  it('passes the value through to Monaco', () => {
    render(<CodeEditor value={'x = 1\n'} onChange={vi.fn()} />)

    expect(lastProps().value).toBe('x = 1\n')
  })

  it('turns the minimap off, wraps words, uses font size 14 and 4-space tabs', () => {
    render(<CodeEditor value="" onChange={vi.fn()} />)

    expect(lastProps().options).toMatchObject({
      minimap: { enabled: false },
      wordWrap: 'on',
      fontSize: 14,
      tabSize: 4,
      insertSpaces: true,
    })
  })

  it('keeps 4-space tabs even when the code uses other indentation', () => {
    render(<CodeEditor value="" onChange={vi.fn()} />)

    expect(lastProps().options).toMatchObject({ detectIndentation: false })
  })

  it('fills the height of its container', () => {
    render(<CodeEditor value="" onChange={vi.fn()} />)

    expect(lastProps().height).toBe('100%')
  })

  it('shows a loading message while Monaco loads', () => {
    render(<CodeEditor value="" onChange={vi.fn()} />)

    expect(lastProps().loading).toBe('Loading editor…')
  })

  it('labels the editor "Code editor" by default', () => {
    render(<CodeEditor value="" onChange={vi.fn()} />)

    expect(lastProps().options).toMatchObject({ ariaLabel: 'Code editor' })
  })

  it('uses the given aria label', () => {
    render(<CodeEditor value="" onChange={vi.fn()} ariaLabel="Solution for FizzBuzz" />)

    expect(lastProps().options).toMatchObject({ ariaLabel: 'Solution for FizzBuzz' })
  })

  it('reports the new value with the characters added and removed and the time of the change', () => {
    const onChange = vi.fn()
    render(<CodeEditor value="hello" onChange={onChange} />)

    emit('x', [{ text: 'x', rangeLength: 5 }])

    expect(onChange).toHaveBeenCalledExactlyOnceWith('x', { charsAdded: 1, charsRemoved: 5, at: NOW.getTime() })
  })

  it('sums all changes of one multi-cursor event into one report', () => {
    const onChange = vi.fn()
    render(<CodeEditor value="" onChange={onChange} />)

    emit('xyxy', [
      { text: 'x', rangeLength: 0 },
      { text: 'x', rangeLength: 0 },
    ])

    expect(onChange).toHaveBeenCalledExactlyOnceWith('xyxy', { charsAdded: 2, charsRemoved: 0, at: NOW.getTime() })
  })

  it('reports every change event separately, never batching them', () => {
    const onChange = vi.fn()
    render(<CodeEditor value="" onChange={onChange} />)

    emit('a', [{ text: 'a', rangeLength: 0 }])
    vi.setSystemTime(NOW.getTime() + 40)
    emit('ab', [{ text: 'b', rangeLength: 0 }])
    vi.setSystemTime(NOW.getTime() + 80)
    emit('a', [{ text: '', rangeLength: 1 }])

    expect(onChange.mock.calls).toEqual([
      ['a', { charsAdded: 1, charsRemoved: 0, at: NOW.getTime() }],
      ['ab', { charsAdded: 1, charsRemoved: 0, at: NOW.getTime() + 40 }],
      ['a', { charsAdded: 0, charsRemoved: 1, at: NOW.getTime() + 80 }],
    ])
  })

  it('reports an empty string when Monaco gives no value', () => {
    const onChange = vi.fn()
    render(<CodeEditor value="a" onChange={onChange} />)

    emit(undefined, [{ text: '', rangeLength: 1 }])

    expect(onChange).toHaveBeenCalledExactlyOnceWith('', { charsAdded: 0, charsRemoved: 1, at: NOW.getTime() })
  })

  it('calls the latest onChange after a re-render', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(<CodeEditor value="" onChange={first} />)
    rerender(<CodeEditor value="" onChange={second} />)

    emit('a', [{ text: 'a', rangeLength: 0 }])

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledOnce()
  })

  it('keeps the same options and change handler while its props stay the same', () => {
    const onChange = vi.fn()
    const { rerender } = render(<CodeEditor value="a" onChange={onChange} />)
    const before = lastProps()

    rerender(<CodeEditor value="ab" onChange={onChange} />)

    expect(lastProps().options).toBe(before.options)
    expect(lastProps().onChange).toBe(before.onChange)
  })
})
