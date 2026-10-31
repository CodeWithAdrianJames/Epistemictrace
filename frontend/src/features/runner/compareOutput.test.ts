import { describe, expect, it } from 'vitest'
import { compareOutput, normalizeOutput } from './compareOutput.ts'

describe('normalizeOutput', () => {
  it('turns \r\n into \n', () => {
    expect(normalizeOutput('a\r\nb')).toBe('a\nb')
  })

  it('strips trailing whitespace from every line', () => {
    expect(normalizeOutput('a  \nb\t\n c ')).toBe('a\nb\n c')
  })

  it('removes trailing empty lines', () => {
    expect(normalizeOutput('a\n\n\n')).toBe('a')
  })

  it('removes trailing lines that only hold whitespace', () => {
    expect(normalizeOutput('a\n  \n\t\n')).toBe('a')
  })

  it('keeps empty lines in the middle', () => {
    expect(normalizeOutput('a\n\nb\n')).toBe('a\n\nb')
  })

  it('keeps leading whitespace and empty leading lines', () => {
    expect(normalizeOutput('\n  a')).toBe('\n  a')
  })

  it('returns an empty string for empty or blank output', () => {
    expect(normalizeOutput('')).toBe('')
    expect(normalizeOutput(' \r\n\n')).toBe('')
  })
})

describe('compareOutput', () => {
  it('matches a trailing newline against none', () => {
    expect(compareOutput('5\n', '5')).toBe(true)
    expect(compareOutput('5', '5\n')).toBe(true)
  })

  it('matches trailing whitespace, \r\n and blank lines against the bare value', () => {
    expect(compareOutput('5 \r\n\n', '5')).toBe(true)
  })

  it('does not match different values', () => {
    expect(compareOutput('5', '6')).toBe(false)
  })

  it('does not match different spacing inside a line', () => {
    expect(compareOutput('a b', 'a  b')).toBe(false)
  })

  it('does not match different leading whitespace', () => {
    expect(compareOutput(' a', 'a')).toBe(false)
  })

  it('does not match different case', () => {
    expect(compareOutput('Yes', 'yes')).toBe(false)
  })

  it('does not match when an inner empty line is missing', () => {
    expect(compareOutput('a\n\nb', 'a\nb')).toBe(false)
  })

  it('matches two empty outputs', () => {
    expect(compareOutput('', '\n')).toBe(true)
  })
})
