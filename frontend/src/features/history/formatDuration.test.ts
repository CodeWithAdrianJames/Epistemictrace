import { describe, expect, it } from 'vitest'
import { formatDuration } from './formatDuration.ts'

describe('formatDuration', () => {
  it.each([
    [null, 'In progress'],
    [0, 'Less than 1 min'],
    [59, 'Less than 1 min'],
    [60, '1 min'],
    [1500, '25 min'],
    [1559, '25 min'],
    [3599, '59 min'],
    [3600, '1 h'],
    [3900, '1 h 5 min'],
    [7260, '2 h 1 min'],
  ])('formats %s seconds as "%s"', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text)
  })
})
