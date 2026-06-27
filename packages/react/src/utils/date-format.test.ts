import { describe, expect, it } from 'vitest'

import { formatNowTime, formatTime } from './date-format.ts'

// Build the date from local-time components so getHours/getMinutes read back
// the same values in any timezone.
function localTime(hours: number, minutes: number): Date {
  return new Date(2026, 0, 1, hours, minutes)
}

// Each case is [hours, minutes, expected].
type Case = [hours: number, minutes: number, expected: string]

describe('formatTime', () => {
  it('formats time in 12-hour format', () => {
    // 12-hour clock drops the leading hour zero and appends am/pm.
    const cases: Case[] = [
      [0, 0, '12:00am'],
      [0, 5, '12:05am'],
      [9, 8, '9:08am'],
      [11, 59, '11:59am'],
      [12, 0, '12:00pm'],
      [12, 30, '12:30pm'],
      [13, 45, '1:45pm'],
      [15, 45, '3:45pm'],
      [23, 9, '11:09pm'],
    ]
    for (const [hours, minutes, expected] of cases) {
      expect(formatTime(localTime(hours, minutes), '12')).toBe(expected)
    }
  })

  it('formats time in 24-hour format', () => {
    // 24-hour clock keeps the leading hour zero and has no suffix.
    const cases: Case[] = [
      [0, 0, '00:00'],
      [0, 5, '00:05'],
      [9, 8, '09:08'],
      [13, 45, '13:45'],
      [15, 45, '15:45'],
      [23, 9, '23:09'],
    ]
    for (const [hours, minutes, expected] of cases) {
      expect(formatTime(localTime(hours, minutes), '24')).toBe(expected)
    }
  })
})

describe('formatNowTime', () => {
  it('formats the current time in 12-hour format', () => {
    expect(formatNowTime('12')).toMatch(/^\d{1,2}:\d{2}(am|pm)$/)
  })

  it('formats the current time in 24-hour format', () => {
    expect(formatNowTime('24')).toMatch(/^\d{2}:\d{2}$/)
  })
})
