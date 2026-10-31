import { describe, expect, it } from 'vitest'
import { formatDateTime } from './formatDateTime.ts'

// Instants are built from local date parts, so the expected text holds in any test time zone.
function localIso(year: number, monthIndex: number, day: number, hour: number, minute: number): string {
  return new Date(year, monthIndex, day, hour, minute).toISOString()
}

describe('formatDateTime', () => {
  it('formats an instant as weekday, day, month, year and 24-hour local time', () => {
    expect(formatDateTime(localIso(2026, 10, 3, 10, 15))).toBe('Tue, 3 Nov 2026, 10:15')
  })

  it('pads hours and minutes to two digits', () => {
    expect(formatDateTime(localIso(2026, 0, 5, 7, 5))).toBe('Mon, 5 Jan 2026, 07:05')
  })

  it('uses 00 for midnight', () => {
    expect(formatDateTime(localIso(2026, 11, 31, 0, 0))).toBe('Thu, 31 Dec 2026, 00:00')
  })
})
