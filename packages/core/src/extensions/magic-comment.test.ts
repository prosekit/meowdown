import { describe, expect, it } from 'vitest'

import { formatMagicComment, parseMagicComment, stripMagicComment } from './magic-comment.ts'

describe('parseMagicComment', () => {
  it('reads the metadata object from the canonical and spaced forms', () => {
    expect(parseMagicComment('<!-- {"width":320} -->')).toEqual({ width: 320 })
    expect(parseMagicComment('<!-- {"width": 1234} -->')).toEqual({ width: 1234 })
  })

  it('rounds width and rejects junk', () => {
    expect(parseMagicComment('<!-- {"width":12.6} -->')).toEqual({ width: 13 })
    expect(parseMagicComment('<!-- {"width":0} -->')).toBeUndefined()
    expect(parseMagicComment('<!-- {"width":"x"} -->')).toBeUndefined()
    expect(parseMagicComment('<!-- {"foo":1} -->')).toBeUndefined()
    expect(parseMagicComment('<!-- hello -->')).toBeUndefined()
    expect(parseMagicComment('<!-- {bad json} -->')).toBeUndefined()
    expect(parseMagicComment('not a comment')).toBeUndefined()
  })
})

describe('formatMagicComment / stripMagicComment', () => {
  it('round-trips through the canonical form', () => {
    const comment = formatMagicComment({ width: 320 })
    expect(comment).toBe('<!-- {"width":320} -->')
    expect(parseMagicComment(comment)).toEqual({ width: 320 })
  })

  it('strips only a trailing comment', () => {
    expect(stripMagicComment('![a](u)<!-- {"width":320} -->')).toBe('![a](u)')
    expect(stripMagicComment('![a](u)')).toBe('![a](u)')
  })
})
