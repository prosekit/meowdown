import { describe, expect, it } from 'vitest'

import { clamp } from './clamp.ts'

describe('clamp', () => {
  it('returns in-range values unchanged', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('clamps to the minimum', () => {
    expect(clamp(-1, 0, 10)).toBe(0)
  })

  it('clamps to the maximum', () => {
    expect(clamp(11, 0, 10)).toBe(10)
  })
})
