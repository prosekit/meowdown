import { describe, expect, it } from 'vitest'

import { formatMetaComment, parseMetaComment, stripMetaComment } from './meta-comment.ts'

describe('parseMetaComment', () => {
  it('reads the metadata object from the canonical and spaced forms', () => {
    expect(parseMetaComment('<!-- {"width":320} -->')).toEqual({ width: 320 })
    expect(parseMetaComment('<!-- {"width": 1234} -->')).toEqual({ width: 1234 })
  })

  it('rounds width and rejects junk', () => {
    expect(parseMetaComment('<!-- {"width":12.6} -->')).toEqual({ width: 13 })
    expect(parseMetaComment('<!-- {"width":0} -->')).toBeUndefined()
    expect(parseMetaComment('<!-- {"width":"x"} -->')).toBeUndefined()
    expect(parseMetaComment('<!-- {"foo":1} -->')).toBeUndefined()
    expect(parseMetaComment('<!-- hello -->')).toBeUndefined()
    expect(parseMetaComment('<!-- {bad json} -->')).toBeUndefined()
    expect(parseMetaComment('not a comment')).toBeUndefined()
  })
})

describe('formatMetaComment / stripMetaComment', () => {
  it('round-trips through the canonical form', () => {
    const comment = formatMetaComment({ width: 320 })
    expect(comment).toBe('<!-- {"width":320} -->')
    expect(parseMetaComment(comment)).toEqual({ width: 320 })
  })

  it('strips only a trailing comment', () => {
    expect(stripMetaComment('![a](u)<!-- {"width":320} -->')).toBe('![a](u)')
    expect(stripMetaComment('![a](u)')).toBe('![a](u)')
  })
})
