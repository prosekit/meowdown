import { describe, expect, it } from 'vitest'

import { findText } from '../testing/find-text.ts'
import { setupTestEnv } from '../testing/index.ts'
import { marksAt } from '../testing/marks-at.ts'

import { getCacheStats, resetCacheStats } from './inline-mark-plugin.ts'

describe('inlineMarkPlugin', () => {
  it('applies mdStrong inside **bold**', () => {
    using env = setupTestEnv()
    const { n } = env
    const doc = n.doc(n.paragraph('Hello **bold** end'))
    env.set(doc)

    const pos = findText(env.doc, 'bold')
    expect(pos).toBeGreaterThan(0)
    expect(marksAt(env.doc, pos + 1)).toEqual(['mdStrong'])
    // The `**` syntax markers carry mdStrong + mdMark.
    expect(marksAt(env.doc, pos - 1)).toEqual(['mdMark', 'mdStrong'])
  })

  it('applies mdEm inside *italic*', () => {
    using env = setupTestEnv()
    const { n } = env
    const doc = n.doc(n.paragraph('an *ital* word'))
    env.set(doc)

    const pos = findText(env.doc, 'ital')
    expect(marksAt(env.doc, pos + 1)).toEqual(['mdEm'])
  })

  it('applies mdCode inside `code`', () => {
    using env = setupTestEnv()
    const { n } = env
    const doc = n.doc(n.paragraph('pre `bar` post'))
    env.set(doc)

    const pos = findText(env.doc, 'bar')
    expect(marksAt(env.doc, pos + 1)).toEqual(['mdCode'])
  })

  it('applies mdLinkText with href attr inside [text](url)', () => {
    using env = setupTestEnv()
    const { n } = env
    const doc = n.doc(n.paragraph('see [docs](http://x.test)'))
    env.set(doc)

    const pos = findText(env.doc, 'docs')
    const $pos = env.doc.resolve(pos + 1)
    const linkText = $pos.marks().find((m) => m.type.name === 'mdLinkText')
    expect(linkText).toBeTruthy()
    expect(linkText!.attrs.href).toBe('http://x.test')
  })

  it('marks `*foo*` inside headings as well', () => {
    using env = setupTestEnv()
    const { n } = env
    const doc = n.doc(n.heading({ level: 2 }, 'an *italic* title'))
    env.set(doc)

    const pos = findText(env.doc, 'italic')
    expect(marksAt(env.doc, pos + 1)).toEqual(['mdEm'])
  })

  it('does NOT mark inline syntax inside code blocks', () => {
    using env = setupTestEnv()
    const { n } = env
    const doc = n.doc(n.codeBlock({ language: '' }, '*not italic*'))
    env.set(doc)

    const pos = findText(env.doc, 'not italic')
    expect(marksAt(env.doc, pos + 1)).toEqual([])
  })

  it('does not infinitely recurse on its own appended transactions', () => {
    using env = setupTestEnv()
    const { n } = env
    const doc = n.doc(n.paragraph('a **b** c'))
    env.set(doc)

    // Waking the plugin again must NOT re-append yet another step on top.
    const before = env.doc
    env.view.dispatch(env.state.tr)
    expect(env.doc.toJSON()).toEqual(before.toJSON())
  })

  it('removes marks when the syntax characters disappear', () => {
    using env = setupTestEnv()
    const { n } = env
    const doc = n.doc(n.paragraph('pre **bold** post'))
    env.set(doc)

    const stars = findText(env.doc, '**')
    expect(stars).toBeGreaterThan(0)
    // Delete the leading "**".
    env.view.dispatch(env.state.tr.delete(stars, stars + 2))
    const text = env.doc.textContent
    expect(text).not.toContain('**bold**')
    const boldPos = findText(env.doc, 'bold')
    expect(marksAt(env.doc, boldPos + 1)).toEqual([])
  })

  it('caches chunks per immutable paragraph node', () => {
    using env = setupTestEnv()
    const { n } = env
    const doc = n.doc(
      n.paragraph('pre *a* one'),
      n.paragraph('pre *b* two'),
      n.paragraph('pre *c* three'),
    )
    env.set(doc)
    // Warm the cache for the current (already-marked) node instances.
    env.view.dispatch(env.state.tr)
    resetCacheStats()
    // Same node instances: every textblock cache-hits.
    env.view.dispatch(env.state.tr)
    const stats = getCacheStats()
    expect(stats.hits).toBeGreaterThanOrEqual(3)
    expect(stats.parses).toBe(0)
  })

  it('only re-parses the edited paragraph, not its siblings', () => {
    using env = setupTestEnv()
    const { n } = env
    const doc = n.doc(
      n.paragraph('untouched A'),
      n.paragraph('edit *here*'),
      n.paragraph('untouched B'),
    )
    env.set(doc)

    const here = findText(env.doc, 'here')
    resetCacheStats()
    // Replace one character inside paragraph 2.
    env.view.dispatch(env.state.tr.insertText('X', here, here + 1))
    const stats = getCacheStats()
    // Exactly one textblock should have been re-parsed (the edited one).
    expect(stats.parses).toBe(1)
  })

  it('marks inline syntax inside a table cell paragraph', () => {
    using env = setupTestEnv()
    const { n } = env
    const doc = n.doc(n.table(n.tableRow(n.tableCell(n.paragraph('cell *italic*')))))
    env.set(doc)

    const pos = findText(env.doc, 'italic')
    expect(marksAt(env.doc, pos + 1)).toEqual(['mdEm'])
  })
})
