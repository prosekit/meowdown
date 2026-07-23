import { describe, expect, it } from 'vitest'

import { markdownToDoc } from '../converters/md-to-pm.ts'

import {
  collectReferenceDefinitions,
  normalizeReferenceLabel,
  parseReferenceDefinition,
} from './reference-links.ts'

describe('normalizeReferenceLabel', () => {
  it('collapses whitespace and applies Unicode case folding', () => {
    expect(normalizeReferenceLabel('  A\t multi\nLINE  ')).toBe('A MULTI LINE')
    expect(normalizeReferenceLabel('Straße')).toBe(normalizeReferenceLabel('STRASSE'))
  })

  it('keeps escaped punctuation distinct', () => {
    expect(normalizeReferenceLabel(String.raw`foo\!`)).not.toBe(normalizeReferenceLabel('foo!'))
  })
})

describe('parseReferenceDefinition', () => {
  it('parses an angle destination and title', () => {
    expect(parseReferenceDefinition('[Plan]: <docs/Q3 plan.md> "Quarterly plan"')).toEqual({
      key: 'PLAN',
      href: 'docs/Q3 plan.md',
      title: 'Quarterly plan',
    })
  })

  it('parses a title on the following line', () => {
    expect(parseReferenceDefinition("[Plan]: docs/plan.md\n  'Quarterly plan'")).toEqual({
      key: 'PLAN',
      href: 'docs/plan.md',
      title: 'Quarterly plan',
    })
  })

  it('decodes character references', () => {
    expect(parseReferenceDefinition('[Plan]: docs/A&amp;B.md "A&#x26;B"')).toEqual({
      key: 'PLAN',
      href: 'docs/A&B.md',
      title: 'A&B',
    })
  })

  it('accepts an empty destination', () => {
    expect(parseReferenceDefinition('[empty]: <>')).toEqual({
      key: 'EMPTY',
      href: '',
      title: '',
    })
  })

  it('rejects ordinary and incomplete text', () => {
    expect(parseReferenceDefinition('Read [Plan][plan].')).toBeUndefined()
    expect(parseReferenceDefinition('[Plan]:')).toBeUndefined()
    expect(parseReferenceDefinition('[Plan] /docs')).toBeUndefined()
  })

  it('accepts the longest label supported by Lezer', () => {
    const label = 'a'.repeat(998)
    expect(parseReferenceDefinition(`[${label}]: /docs`)?.href).toBe('/docs')
  })

  it.fails('accepts a label at the CommonMark limit', () => {
    const label = 'a'.repeat(999)
    expect(parseReferenceDefinition(`[${label}]: /docs`)?.href).toBe('/docs')
  })

  it('rejects a label longer than the CommonMark limit', () => {
    const label = 'a'.repeat(1_000)
    expect(parseReferenceDefinition(`[${label}]: /docs`)).toBeUndefined()
  })
})

describe('collectReferenceDefinitions', () => {
  it('collects definitions document-wide and keeps the first duplicate', () => {
    const doc = markdownToDoc(
      [
        'Read [Plan][plan].',
        '',
        '[PLAN]: docs/first.md "First"',
        '',
        '[plan]: docs/second.md',
      ].join('\n'),
    )

    const index = collectReferenceDefinitions(doc)
    expect([...index.definitions.values()]).toEqual([
      { key: 'PLAN', href: 'docs/first.md', title: 'First' },
    ])
    expect(index.nodes.size).toBe(2)
  })

  it('rejects headings, table cells, and the task marker paragraph', () => {
    const doc = markdownToDoc(
      [
        '# [heading]: /heading',
        '',
        '| Cell |',
        '| --- |',
        '| [table]: /table |',
        '',
        '- [ ] [task]: /task',
        '',
        '- [ ] task body',
        '',
        '  [task-child]: /task-child',
        '',
        '> [quote]: /quote',
        '',
        '- [bullet]: /bullet',
      ].join('\n'),
    )

    expect([...collectReferenceDefinitions(doc).definitions.keys()]).toEqual([
      'TASK-CHILD',
      'QUOTE',
      'BULLET',
    ])
  })

  it('reuses cached definitions for unchanged paragraph nodes', () => {
    const doc = markdownToDoc('[doc]: /docs')
    const first = collectReferenceDefinitions(doc).definitions.get('DOC')
    const second = collectReferenceDefinitions(doc).definitions.get('DOC')
    expect(second).toBe(first)
  })
})
