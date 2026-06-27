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
    expect(marksAt(fixture.doc, pos + 1)).toEqual(['mdPack', 'mdStrong'])
    // The `**` syntax markers carry the pack, mdStrong + mdMark.
    expect(marksAt(fixture.doc, pos - 1)).toEqual(['mdMark', 'mdPack', 'mdStrong'])
  })

  it('applies mdEm inside *italic*', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.paragraph('an *ital* word'))
    fixture.set(doc)

    const pos = findText(fixture.doc, 'ital')
    expect(marksAt(fixture.doc, pos + 1)).toEqual(['mdEm', 'mdPack'])
  })

  it('applies mdCode inside `code`', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.paragraph('pre `bar` post'))
    fixture.set(doc)

    const pos = findText(fixture.doc, 'bar')
    expect(marksAt(fixture.doc, pos + 1)).toEqual(['mdCode', 'mdPack'])
  })

  it('applies mdHighlight inside ==text==', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.paragraph('pre ==hi== post'))
    fixture.set(doc)

    const pos = findText(fixture.doc, 'hi')
    expect(marksAt(fixture.doc, pos + 1)).toEqual(['mdHighlight', 'mdPack'])
    // The `==` syntax markers carry the pack, mdHighlight + mdMark.
    expect(marksAt(fixture.doc, pos - 1)).toEqual(['mdHighlight', 'mdMark', 'mdPack'])
  })

  it('keeps nested mdStrong inside ==**bold**==', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.paragraph('x ==**bold**== y'))
    fixture.set(doc)

    const pos = findText(fixture.doc, 'bold')
    expect(marksAt(fixture.doc, pos + 1)).toEqual(['mdHighlight', 'mdPack', 'mdPack', 'mdStrong'])
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

  it('applies mdLinkText with a derived href on a bare autolink', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.paragraph('visit https://example.com now'))
    fixture.set(doc)

    const pos = findText(fixture.doc, 'https://example.com')
    const $pos = fixture.doc.resolve(pos + 1)
    const linkText = $pos.marks().find((m) => m.type.name === 'mdLinkText')
    expect(linkText).toBeTruthy()
    expect(linkText!.attrs.href).toBe('https://example.com')
  })

  it('applies mdLinkText with an https href on a bare domain', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.paragraph('visit google.com now'))
    fixture.set(doc)

    const pos = findText(fixture.doc, 'google.com')
    const $pos = fixture.doc.resolve(pos + 1)
    const linkText = $pos.marks().find((m) => m.type.name === 'mdLinkText')
    expect(linkText).toBeTruthy()
    expect(linkText!.attrs.href).toBe('https://google.com')
  })

  it('leaves a bare host off the TLD list as plain text', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.paragraph('open README.md now'))
    fixture.set(doc)

    const pos = findText(fixture.doc, 'README.md')
    expect(marksAt(fixture.doc, pos + 1)).toEqual([])
  })

  it('marks `*foo*` inside headings as well', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.heading({ level: 2 }, 'an *italic* title'))
    fixture.set(doc)

    const pos = findText(fixture.doc, 'italic')
    expect(marksAt(fixture.doc, pos + 1)).toEqual(['mdEm', 'mdPack'])
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
    expect(marksAt(fixture.doc, pos + 1)).toEqual(['mdEm', 'mdPack'])
  })

  it('applies mdTag across the whole #tag, # included', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.paragraph('Hello #meow end'))
    fixture.set(doc)

    const pos = findText(fixture.doc, '#meow')
    expect(pos).toBeGreaterThan(0)
    expect(marksAt(fixture.doc, pos + 1)).toEqual(['mdTag']) // the '#'
    expect(marksAt(fixture.doc, pos + 5)).toEqual(['mdTag']) // the 'w'
    expect(marksAt(fixture.doc, pos)).toEqual([]) // the space before
  })

  it('marks tags inside headings', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.heading({ level: 2 }, 'Title #tag'))
    fixture.set(doc)

    const pos = findText(fixture.doc, '#tag')
    expect(marksAt(fixture.doc, pos + 1)).toEqual(['mdTag'])
  })

  it('does NOT mark #tag inside code blocks', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.codeBlock({ language: '' }, 'a #tag b'))
    fixture.set(doc)

    const pos = findText(fixture.doc, '#tag')
    expect(marksAt(fixture.doc, pos + 1)).toEqual([])
  })

  it('applies mdWikilink across the whole [[note]]', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.paragraph('see [[note]] end'))
    fixture.set(doc)

    const open = findText(fixture.doc, '[[')
    const target = findText(fixture.doc, 'note')
    expect(open).toBeGreaterThan(0)
    expect(marksAt(fixture.doc, open + 1)).toEqual(['mdWikilink'])
    expect(marksAt(fixture.doc, target + 1)).toEqual(['mdWikilink'])
    expect(marksAt(fixture.doc, open)).toEqual([]) // the space before
  })

  it('marks wikilinks inside headings', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.heading({ level: 3 }, 'Title [[note]]'))
    fixture.set(doc)

    const pos = findText(fixture.doc, 'note')
    expect(marksAt(fixture.doc, pos + 1)).toEqual(['mdWikilink'])
  })

  it('does not mark [[note]] inside code blocks', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.codeBlock({ language: '' }, 'a [[note]] b'))
    fixture.set(doc)

    const pos = findText(fixture.doc, 'note')
    expect(marksAt(fixture.doc, pos + 1)).toEqual([])
  })

  it('removes mdWikilink when the closing ] is deleted', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.paragraph('see [[note]] end'))
    fixture.set(doc)

    const pos = findText(fixture.doc, 'note')
    expect(marksAt(fixture.doc, pos + 1)).toEqual(['mdWikilink'])
    // Delete one ']': "see [[note] end" is no longer a wikilink. The inner
    // `[note]` becomes a shortcut reference link, so it loses mdWikilink
    // but gains the link pack wrapper.
    const firstBracket = findText(fixture.doc, ']')
    fixture.view.dispatch(fixture.state.tr.delete(firstBracket + 1, firstBracket + 2))
    const after = findText(fixture.doc, 'note')
    expect(marksAt(fixture.doc, after + 1)).toEqual(['mdPack'])
  })

  it('removes mdTag when text is glued in front of the #', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.paragraph('a #tag b'))
    fixture.set(doc)

    const pos = findText(fixture.doc, '#tag')
    expect(marksAt(fixture.doc, pos + 1)).toEqual(['mdTag'])
    // Delete the space before the '#': "a#tag b" is no longer a tag.
    fixture.view.dispatch(fixture.state.tr.delete(pos - 1, pos))
    const glued = findText(fixture.doc, '#tag')
    expect(marksAt(fixture.doc, glued + 1)).toEqual([])
  })
})
