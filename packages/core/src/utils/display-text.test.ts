import { describe, expect, it } from 'vitest'

import { resolveWikilinkAlias, setupFixture } from '../testing/index.ts'

import { getTextblockDisplayText } from './display-text.ts'

describe('getTextblockDisplayText', () => {
  it('keeps plain text and drops inline syntax runs', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.heading({ level: 2 }, 'Hello **bold** and [label](https://example.com)')))
    expect(getTextblockDisplayText(fixture.doc.child(0))).toBe('Hello bold and label')
  })

  it('replaces a wikilink with its display text, falling back to the target', () => {
    using fixture = setupFixture({ extensionOptions: { resolveWikilink: resolveWikilinkAlias } })
    const { n } = fixture
    fixture.set(n.doc(n.heading({ level: 1 }, 'see [[target|shown]] and [[bare]]')))
    expect(getTextblockDisplayText(fixture.doc.child(0))).toBe('see shown and bare')
  })

  it('replaces an image with its alt text and math with its formula', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.heading({ level: 1 }, '![pic](a.png) equals $x+y$')))
    expect(getTextblockDisplayText(fixture.doc.child(0))).toBe('pic equals x+y')
  })

  it('replaces a file pill with its name', () => {
    using fixture = setupFixture({ extensionOptions: { resolveFileLink: () => true } })
    const { n } = fixture
    fixture.set(n.doc(n.heading({ level: 1 }, 'read [report.pdf](files/report.pdf)')))
    expect(getTextblockDisplayText(fixture.doc.child(0))).toBe('read report.pdf')
  })

  it('replaces both of two adjacent identical atoms', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.heading({ level: 1 }, '[[a]][[a]]')))
    expect(getTextblockDisplayText(fixture.doc.child(0))).toBe('aa')
  })

  it('splits adjacent identical atoms after a JSON round trip', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.heading({ level: 1 }, '[[a]][[a]] and $x$')))
    // A round trip loses mark instance identity, leaving pack equality as the
    // only unit boundary.
    const doc = fixture.editor.schema.nodeFromJSON(fixture.doc.toJSON())
    expect(getTextblockDisplayText(doc.child(0))).toBe('aa and x')
  })
})
