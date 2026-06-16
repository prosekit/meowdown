import { describe, expect, it } from 'vitest'

import { getMarkBuilders, getNodeBuilders } from './schema.ts'

describe('getNodeBuilders', () => {
  it('builds a node from the shared schema', () => {
    const nodes = getNodeBuilders()
    const paragraph = nodes.paragraph('hello')
    expect(paragraph.type.name).toBe('paragraph')
    expect(paragraph.textContent).toBe('hello')
  })

  it('returns a memoized instance', () => {
    expect(getNodeBuilders()).toBe(getNodeBuilders())
  })
})

describe('getMarkBuilders', () => {
  it('applies a mark to its children', () => {
    const marks = getMarkBuilders()
    const nodes = marks.mdStrong('bold')
    const markNames = nodes.flatMap((node) => node.marks.map((mark) => mark.type.name))
    expect(markNames).toContain('mdStrong')
  })

  it('returns a memoized instance', () => {
    expect(getMarkBuilders()).toBe(getMarkBuilders())
  })
})
