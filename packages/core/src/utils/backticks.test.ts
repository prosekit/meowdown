import { describe, expect, it } from 'vitest'

import { longestBacktickRun } from './backticks.ts'

describe('longestBacktickRun', () => {
  it.each([
    ['', 0],
    ['no backticks', 0],
    ['`', 1],
    ['a `b` c', 1],
    ['a ``b`` c', 2],
    ['`` ` ```', 3],
    ['```', 3],
  ])('%j -> %i', (text, expected) => {
    expect(longestBacktickRun(text)).toBe(expected)
  })

  it('clamps to min', () => {
    expect(longestBacktickRun('', 2)).toBe(2)
    expect(longestBacktickRun('````', 2)).toBe(4)
  })
})
