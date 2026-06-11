import { describe, expect, it } from 'vitest'

import { findText } from '../testing/find-text.ts'
import { setupFixture } from '../testing/index.ts'
import { marksAt } from '../testing/marks-at.ts'

import { getCacheStats, resetCacheStats } from './inline-mark-plugin.ts'

describe('inlineMarkPlugin', () => {
  it('applies mdStrong inside **bold**', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.paragraph('Hello **bold** end'))
    fixture.set(doc)

    const pos = findText(fixture.doc, 'bold')
    expect(pos).toBeGreaterThan(0)
    expect(marksAt(fixture.doc, pos + 1)).toEqual(['mdStrong'])
    // The `**` syntax markers carry mdStrong + mdMark.
    expect(marksAt(fixture.doc, pos - 1)).toEqual(['mdMark', 'mdStrong'])
  })

  it('applies mdEm inside *italic*', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.paragraph('an *ital* word'))
    fixture.set(doc)

    const pos = findText(fixture.doc, 'ital')
    expect(marksAt(fixture.doc, pos + 1)).toEqual(['mdEm'])
  })

  it('applies mdCode inside `code`', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.paragraph('pre `bar` post'))
    fixture.set(doc)

    const pos = findText(fixture.doc, 'bar')
    expect(marksAt(fixture.doc, pos + 1)).toEqual(['mdCode'])
  })

  it('applies mdLinkText with href attr inside [text](url)', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.paragraph('see [docs](http://x.test)'))
    fixture.set(doc)

    const pos = findText(fixture.doc, 'docs')
    const $pos = fixture.doc.resolve(pos + 1)
    const linkText = $pos.marks().find((m) => m.type.name === 'mdLinkText')
    expect(linkText).toBeTruthy()
    expect(linkText!.attrs.href).toBe('http://x.test')
  })

  it('marks `*foo*` inside headings as well', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.heading({ level: 2 }, 'an *italic* title'))
    fixture.set(doc)

    const pos = findText(fixture.doc, 'italic')
    expect(marksAt(fixture.doc, pos + 1)).toEqual(['mdEm'])
  })

  it('does NOT mark inline syntax inside code blocks', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.codeBlock({ language: '' }, '*not italic*'))
    fixture.set(doc)

    const pos = findText(fixture.doc, 'not italic')
    expect(marksAt(fixture.doc, pos + 1)).toEqual([])
  })

  it('does not infinitely recurse on its own appended transactions', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.paragraph('a **b** c'))
    fixture.set(doc)

    // Waking the plugin again must NOT re-append yet another step on top.
    const before = fixture.doc
    fixture.view.dispatch(fixture.state.tr)
    expect(fixture.doc.toJSON()).toEqual(before.toJSON())
  })

  it('removes marks when the syntax characters disappear', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.paragraph('pre **bold** post'))
    fixture.set(doc)

    const stars = findText(fixture.doc, '**')
    expect(stars).toBeGreaterThan(0)
    // Delete the leading "**".
    fixture.view.dispatch(fixture.state.tr.delete(stars, stars + 2))
    const text = fixture.doc.textContent
    expect(text).not.toContain('**bold**')
    const boldPos = findText(fixture.doc, 'bold')
    expect(marksAt(fixture.doc, boldPos + 1)).toEqual([])
  })

  it('caches chunks per immutable paragraph node', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(
      n.paragraph('pre *a* one'),
      n.paragraph('pre *b* two'),
      n.paragraph('pre *c* three'),
    )
    fixture.set(doc)
    // Warm the cache for the current (already-marked) node instances.
    fixture.view.dispatch(fixture.state.tr)
    resetCacheStats()
    // Same node instances: every textblock cache-hits.
    fixture.view.dispatch(fixture.state.tr)
    const stats = getCacheStats()
    expect(stats.hits).toBeGreaterThanOrEqual(3)
    expect(stats.parses).toBe(0)
  })

  it('only re-parses the edited paragraph, not its siblings', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(
      n.paragraph('untouched A'),
      n.paragraph('edit *here*'),
      n.paragraph('untouched B'),
    )
    fixture.set(doc)

    const here = findText(fixture.doc, 'here')
    resetCacheStats()
    // Replace one character inside paragraph 2.
    fixture.view.dispatch(fixture.state.tr.insertText('X', here, here + 1))
    const stats = getCacheStats()
    // Exactly one textblock should have been re-parsed (the edited one).
    expect(stats.parses).toBe(1)
  })

  it('marks inline syntax inside a table cell paragraph', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.table(n.tableRow(n.tableCell(n.paragraph('cell *italic*')))))
    fixture.set(doc)

    const pos = findText(fixture.doc, 'italic')
    expect(marksAt(fixture.doc, pos + 1)).toEqual(['mdEm'])
  })
})
