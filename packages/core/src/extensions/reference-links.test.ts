import { describe, expect, it } from 'vitest'

import { markdownToDoc } from '../converters/md-to-pm.ts'

import {
  collectReferenceDefinitions,
  getReferenceDefinitionParseCount,
  normalizeReferenceLabel,
  parseReferenceDefinition,
  resetReferenceDefinitionParseCount,
} from './reference-links.ts'

describe('normalizeReferenceLabel', () => {
  it('preserves escapes, collapses whitespace, and Unicode case-folds', () => {
    const label = `${String.raw`  A\*`}\t multi\nLINE  `
    expect(normalizeReferenceLabel(label)).toBe(String.raw`A\* MULTI LINE`)
    expect(normalizeReferenceLabel('Straße')).toBe(normalizeReferenceLabel('STRASSE'))
  })
})

describe('parseReferenceDefinition', () => {
  it('parses an angle-bracket destination and title', () => {
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

  it('rejects ordinary text', () => {
    expect(parseReferenceDefinition('Read [Plan][plan].')).toBeNull()
  })

  it('decodes character references in destinations and titles', () => {
    expect(parseReferenceDefinition('[Plan]: docs/A&amp;B.md "A&#x26;B"')).toEqual({
      key: 'PLAN',
      href: 'docs/A&B.md',
      title: 'A&B',
    })
  })
})

describe('collectReferenceDefinitions', () => {
  it('collects definitions document-wide and keeps the first duplicate', () => {
    const doc = markdownToDoc(
      ['Read [Plan][plan].', '', '[PLAN]: docs/first.md "First"', '', '[plan]: second.md'].join(
        '\n',
      ),
    )

    const index = collectReferenceDefinitions(doc)
    expect([...index.definitions.values()]).toEqual([
      { key: 'PLAN', href: 'docs/first.md', title: 'First' },
    ])
    expect(index.signature).toBe('[["PLAN","docs/first.md","First"]]')
    expect(index.entries).toHaveLength(2)
  })

  it('rejects definition-shaped headings, table cells, and task items', () => {
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

    const index = collectReferenceDefinitions(doc)
    expect([...index.definitions.keys()]).toEqual(['TASK-CHILD', 'QUOTE', 'BULLET'])
  })

  it('uses a cheap guard before invoking the block parser', () => {
    resetReferenceDefinitionParseCount()
    expect(parseReferenceDefinition('ordinary paragraph')).toBeNull()
    expect(getReferenceDefinitionParseCount()).toBe(0)
    expect(parseReferenceDefinition('[doc]: /docs')).not.toBeNull()
    expect(getReferenceDefinitionParseCount()).toBe(1)
  })
})
