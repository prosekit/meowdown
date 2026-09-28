import { describe, expect, it } from 'vitest'

import { dedentContinuation, measureContentColumn, sliceColumn } from './parse.ts'

describe('measureContentColumn', () => {
  it('is 0 at the document start', () => {
    expect(measureContentColumn('hello', 0)).toBe(0)
  })

  it('is 0 at the start of a line', () => {
    expect(measureContentColumn('abc\nx', 4)).toBe(0)
  })

  it('counts the characters before the position', () => {
    expect(measureContentColumn('- item', 2)).toBe(2)
  })

  it('measures only the current line', () => {
    expect(measureContentColumn('abc\n  x', 6)).toBe(2)
  })

  it('counts a tab from column 0 as 4', () => {
    expect(measureContentColumn('\tx', 1)).toBe(4)
  })

  it('counts a tab to the next multiple of 4', () => {
    expect(measureContentColumn('a\tx', 2)).toBe(4)
    expect(measureContentColumn('ab\tx', 3)).toBe(4)
    expect(measureContentColumn('abc\tx', 4)).toBe(4)
  })

  it('accumulates multiple tabs', () => {
    expect(measureContentColumn('\t\tx', 2)).toBe(8)
  })
})

describe('sliceColumn', () => {
  it('drops leading spaces up to the column', () => {
    expect(sliceColumn('  line', 2)).toBe('line')
  })

  it('leaves a line that stops short of the column', () => {
    expect(sliceColumn('  line', 8)).toBe('  line')
  })

  it('keeps whitespace beyond the column', () => {
    expect(sliceColumn('    deep', 2)).toBe('  deep')
  })

  it('advances a tab to the next multiple of 4', () => {
    expect(sliceColumn('\tx', 4)).toBe('x')
    expect(sliceColumn(' \tx', 4)).toBe('x')
    expect(sliceColumn('  \tx', 4)).toBe('x')
    expect(sliceColumn('   \tx', 4)).toBe('x')
  })

  it('stops once a tab reaches the column', () => {
    expect(sliceColumn('\t\tx', 4)).toBe('\tx')
  })

  it('leaves a tab that would reach past the column', () => {
    expect(sliceColumn('\tx', 2)).toBe('\tx')
  })

  it('returns the line unchanged at column 0', () => {
    expect(sliceColumn('  line', 0)).toBe('  line')
  })
})

describe('dedentContinuation', () => {
  it('returns single-line content unchanged', () => {
    expect(dedentContinuation('hello', 2)).toBe('hello')
  })

  it('returns content unchanged at column 0', () => {
    expect(dedentContinuation('a\n  b', 0)).toBe('a\n  b')
  })

  it('keeps the first line and dedents the rest', () => {
    expect(dedentContinuation('one\n    two', 2)).toBe('one\n  two')
  })

  it('strips the full column from each continuation line', () => {
    expect(dedentContinuation('line one\n  line two\n  line three', 2)).toBe(
      'line one\nline two\nline three',
    )
  })
})
