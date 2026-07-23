import type { EditorNode } from '@prosekit/pm/model'
import { describe, expect, it } from 'vitest'

import { findText } from '../testing/find-text.ts'
import { setupFixture } from '../testing/index.ts'
import { marksAt } from '../testing/marks-at.ts'

import { flushPendingRestyle, getCacheStats, resetCacheStats } from './inline-mark-plugin.ts'
import { isMarkOfType } from './mark-names.ts'

function getLinkHref(doc: EditorNode, label: string): string | undefined {
  const position = findText(doc, label)
  const link = doc
    .resolve(position + 1)
    .marks()
    .find((mark) => isMarkOfType(mark, 'mdLinkText'))
  return typeof link?.attrs.href === 'string' ? link.attrs.href : undefined
}

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

  it('applies mdMath across the whole $x$', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.paragraph('pre $x+y$ post'))
    fixture.set(doc)

    const pos = findText(fixture.doc, 'x+y')
    expect(marksAt(fixture.doc, pos + 1)).toEqual(['mdMath', 'mdPack'])
    // The single-char `$` run never has an interior position, so read the
    // marks off its text node: the pack, mdMath + mdMark.
    const dollarNode = fixture.doc.nodeAt(pos - 1)
    expect(dollarNode?.marks.map((mark) => mark.type.name).sort()).toEqual([
      'mdMark',
      'mdMath',
      'mdPack',
    ])
  })

  it('removes mdMath when a dollar disappears', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.paragraph('pre $x$ post'))
    fixture.set(doc)

    const dollar = findText(fixture.doc, '$')
    expect(dollar).toBeGreaterThan(0)
    fixture.view.dispatch(fixture.state.tr.delete(dollar, dollar + 1))
    const pos = findText(fixture.doc, 'x')
    expect(marksAt(fixture.doc, pos + 1)).toEqual([])
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
    const linkText = $pos.marks().find((m) => isMarkOfType(m, 'mdLinkText'))
    expect(linkText).toBeTruthy()
    expect(linkText!.attrs.href).toBe('http://x.test')
  })

  it('keeps a definition label literal while autolinking its URL', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('[doc]: https://example.com')))

    expect(getLinkHref(fixture.doc, 'doc')).toBeUndefined()
    expect(getLinkHref(fixture.doc, 'https://example.com')).toBe('https://example.com')
  })

  it('applies mdLinkText with a derived href on a bare autolink', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.paragraph('visit https://example.com now'))
    fixture.set(doc)

    const pos = findText(fixture.doc, 'https://example.com')
    const $pos = fixture.doc.resolve(pos + 1)
    const linkText = $pos.marks().find((m) => isMarkOfType(m, 'mdLinkText'))
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
    const linkText = $pos.marks().find((m) => isMarkOfType(m, 'mdLinkText'))
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
    fixture.view.dispatch(fixture.state.tr.setMeta('inline-marks-trigger', true))
    resetCacheStats()
    // Same node instances: every textblock cache-hits.
    fixture.view.dispatch(fixture.state.tr.setMeta('inline-marks-trigger', true))
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
    // Delete one ']': "see [[note] end" is no longer a wikilink. Lezer parses
    // the inner `[note]` as a shortcut reference link, which meowdown renders
    // as plain text, so all marks disappear.
    const firstBracket = findText(fixture.doc, ']')
    fixture.view.dispatch(fixture.state.tr.delete(firstBracket + 1, firstBracket + 2))
    const after = findText(fixture.doc, 'note')
    expect(marksAt(fixture.doc, after + 1)).toEqual([])
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

  it('updates only references that use the changed definition key', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(
      n.doc(
        n.paragraph('[Alpha][alpha]'),
        n.paragraph('[Beta][beta]'),
        n.paragraph('[alpha]: /old-alpha'),
        n.paragraph('[beta]: /old-beta'),
      ),
    )

    resetCacheStats()
    const destination = findText(fixture.doc, '/old-alpha')
    fixture.view.dispatch(
      fixture.state.tr.insertText('/new-alpha', destination, destination + '/old-alpha'.length),
    )
    flushPendingRestyle(fixture.view)

    expect(getLinkHref(fixture.doc, 'Alpha')).toBe('/new-alpha')
    expect(getLinkHref(fixture.doc, 'Beta')).toBe('/old-beta')
    expect(getCacheStats().parses).toBe(2)
  })

  it('resolves an existing unresolved reference when its definition appears', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('Read [Plan][doc].'), n.paragraph('[doc] /new')))

    expect(getLinkHref(fixture.doc, 'Plan')).toBeUndefined()

    const definition = findText(fixture.doc, '[doc] /new')
    fixture.view.dispatch(fixture.state.tr.insertText(':', definition + '[doc]'.length))
    flushPendingRestyle(fixture.view)

    expect(getLinkHref(fixture.doc, 'Plan')).toBe('/new')
  })

  it('removes reference marks when its definition disappears', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('Read [Plan][doc].'), n.paragraph('[doc]: /docs')))

    const colon = findText(fixture.doc, ':')
    fixture.view.dispatch(fixture.state.tr.delete(colon, colon + 1))
    flushPendingRestyle(fixture.view)

    expect(getLinkHref(fixture.doc, 'Plan')).toBeUndefined()
    expect(marksAt(fixture.doc, findText(fixture.doc, 'Plan') + 1)).toEqual([])
  })

  it('promotes the next duplicate after deleting the first definition', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(
      n.doc(
        n.paragraph('[Plan][doc]'),
        n.paragraph('[doc]: /first'),
        n.paragraph('[DOC]: /second'),
      ),
    )

    const from = fixture.doc.child(0).nodeSize
    const to = from + fixture.doc.child(1).nodeSize
    fixture.view.dispatch(fixture.state.tr.delete(from, to))
    flushPendingRestyle(fixture.view)
    expect(getLinkHref(fixture.doc, 'Plan')).toBe('/second')
  })

  it('does not invalidate dependents when a shadowed duplicate changes', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(
      n.doc(
        n.paragraph('[Plan][doc]'),
        n.paragraph('[doc]: /first'),
        n.paragraph('[DOC]: /second'),
      ),
    )

    resetCacheStats()
    const destination = findText(fixture.doc, '/second')
    fixture.view.dispatch(
      fixture.state.tr.insertText('/ignored', destination, destination + '/second'.length),
    )

    expect(getLinkHref(fixture.doc, 'Plan')).toBe('/first')
    expect(getCacheStats().parses).toBe(1)
  })

  it('retains a definition across an external AddMarkStep', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('[doc]: /real'), n.paragraph('Read [Doc].')))

    const definition = findText(fixture.doc, '[doc]:')
    fixture.view.dispatch(
      fixture.state.tr.addMark(
        definition,
        definition + '[doc]'.length,
        fixture.schema.marks.mdEm.create(),
      ),
    )

    expect(getLinkHref(fixture.doc, 'Doc')).toBe('/real')
  })

  it('discovers a definition after AttrStep changes its list kind', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(
      n.doc(n.list({ kind: 'task' }, n.paragraph('[doc]: /new')), n.paragraph('Read [Doc].')),
    )

    fixture.view.dispatch(fixture.state.tr.setNodeAttribute(0, 'kind', 'bullet'))
    flushPendingRestyle(fixture.view)
    expect(getLinkHref(fixture.doc, 'Doc')).toBe('/new')
  })

  it('does not reparse unchanged definitions on an unrelated edit', () => {
    using fixture = setupFixture()
    const { n } = fixture
    const ordinary = Array.from({ length: 1_000 }, (_, index) => n.paragraph(`line ${index}`))
    fixture.set(n.doc(n.paragraph('[doc]: /docs'), ...ordinary))

    resetCacheStats()
    const last = findText(fixture.doc, 'line 999')
    fixture.view.dispatch(fixture.state.tr.insertText('X', last, last + 1))

    expect(getCacheStats().parses).toBe(1)
  })

  it('does no inline parsing for a selection-only transaction', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('first'), n.paragraph('second')))

    resetCacheStats()
    editor.commands.selectText(2)
    expect(getCacheStats()).toEqual({ parses: 0, hits: 0 })
  })

  it('invalidates cached definition context when a list kind changes', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(
      n.doc(n.list({ kind: 'bullet' }, n.paragraph('[doc]: /docs')), n.paragraph('Read [Doc].')),
    )
    expect(getLinkHref(fixture.doc, 'Doc')).toBe('/docs')

    fixture.view.dispatch(fixture.state.tr.setNodeAttribute(0, 'kind', 'task'))
    flushPendingRestyle(fixture.view)
    expect(getLinkHref(fixture.doc, 'Doc')).toBeUndefined()

    fixture.view.dispatch(fixture.state.tr.setNodeAttribute(0, 'kind', 'bullet'))
    flushPendingRestyle(fixture.view)
    expect(getLinkHref(fixture.doc, 'Doc')).toBe('/docs')
  })
})
