import { describe, expect, it } from 'vitest'

import { markdownToDoc } from './md-to-pm.ts'
import { docToMarkdown } from './pm-to-md.ts'

const roundtrip = (markdown: string) => docToMarkdown(markdownToDoc(markdown))

describe('empty list items keep their marker', () => {
  it('does not drop a lone empty bullet', () => {
    expect(roundtrip('- ')).toBe('-\n')
    expect(roundtrip('-')).toBe('-\n')
  })

  it('keeps an empty item between two filled items', () => {
    // Before the fix the middle item vanished and the list collapsed to two.
    expect(roundtrip('- a\n- \n- b')).toBe('- a\n-\n- b\n')
  })

  it('keeps a leading and a trailing empty item', () => {
    expect(roundtrip('- a\n- ')).toBe('- a\n-\n')
    expect(roundtrip('- \n- b')).toBe('-\n- b\n')
  })

  it('keeps an empty task or ordered item marker', () => {
    expect(roundtrip('- [ ] ')).toBe('- [ ]\n')
    expect(roundtrip('1. ')).toBe('1.\n')
  })

  it('is stable: the canonical empty-item form round-trips again unchanged', () => {
    expect(roundtrip('-')).toBe('-\n')
    expect(roundtrip('- a\n-\n- b')).toBe('- a\n-\n- b\n')
    expect(roundtrip('- [ ]')).toBe('- [ ]\n')
  })
})
