import { describe, expect, it } from 'vitest'

import { formatFileSize } from './format-file-size.ts'

describe('formatFileSize', () => {
  it('shows bytes below 1000 as-is', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(1)).toBe('1 B')
    expect(formatFileSize(999)).toBe('999 B')
  })

  it('uses decimal units', () => {
    expect(formatFileSize(1000)).toBe('1 KB')
    expect(formatFileSize(1_000_000)).toBe('1 MB')
    expect(formatFileSize(1_000_000_000)).toBe('1 GB')
    expect(formatFileSize(1_000_000_000_000)).toBe('1 TB')
  })

  it('keeps one decimal below 10 and drops a trailing zero', () => {
    expect(formatFileSize(1400)).toBe('1.4 KB')
    expect(formatFileSize(1_492_337)).toBe('1.5 MB')
    expect(formatFileSize(2_000_000)).toBe('2 MB')
    expect(formatFileSize(9_940_000)).toBe('9.9 MB')
  })

  it('rounds to integers from 10 up', () => {
    expect(formatFileSize(9_950_000)).toBe('10 MB')
    expect(formatFileSize(23_400_000)).toBe('23 MB')
    expect(formatFileSize(999_000)).toBe('999 KB')
  })

  it('moves to the next unit when rounding would reach 1000', () => {
    expect(formatFileSize(999.5)).toBe('1 KB')
    expect(formatFileSize(999_500)).toBe('1 MB')
  })
})
