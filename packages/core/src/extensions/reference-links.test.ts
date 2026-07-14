import { describe, expect, it } from 'vitest'

import { markdownToDoc } from '../converters/md-to-pm.ts'

import {
  collectReferenceDefinitions,
  normalizeReferenceLabel,
  parseReferenceDefinition,
} from './reference-links.ts'

describe('normalizeReferenceLabel', () => {
  it('unescapes punctuation, collapses whitespace, and case-folds', () => {
    expect(normalizeReferenceLabel('  A\\*\t multi\nLINE  ')).toBe('a* multi line')
  })
})

describe('parseReferenceDefinition', () => {
  it('parses an angle-bracket destination and title', () => {
    expect(parseReferenceDefinition('[Plan]: <docs/Q3 plan.md> "Quarterly plan"')).toEqual({
      key: 'plan',
      href: 'docs/Q3 plan.md',
      title: 'Quarterly plan',
    })
  })

  it('parses a title on the following line', () => {
    expect(parseReferenceDefinition("[Plan]: docs/plan.md\n  'Quarterly plan'")).toEqual({
      key: 'plan',
      href: 'docs/plan.md',
      title: 'Quarterly plan',
    })
  })

  it('rejects ordinary text', () => {
    expect(parseReferenceDefinition('Read [Plan][plan].')).toBeNull()
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
      { key: 'plan', href: 'docs/first.md', title: 'First' },
    ])
    expect(index.signature).toBe('[["plan","docs/first.md","First"]]')
  })
})
