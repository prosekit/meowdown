import { describe, expect, it } from 'vitest'

import { setupFixture } from '../testing/index.ts'

import { getTextblockDisplayText } from './display-text.ts'

describe('getTextblockDisplayText', () => {
  it('keeps plain text and drops inline syntax runs', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.heading({ level: 2 }, 'Hello **bold** and [label](https://example.com)')))
    expect(getTextblockDisplayText(fixture.doc.child(0))).toBe('Hello bold and label')
  })

  it('replaces a wikilink with its display text, falling back to the target', () => {
    using fixture = setupFixture()
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

  it('cannot split adjacent identical atoms', () => {
    using fixture = setupFixture()
    const { n } = fixture
    // Adjacent same-attrs units merge into one text node carrying one mark
    // instance, so the document cannot tell the two units apart.
    fixture.set(n.doc(n.heading({ level: 1 }, '[[a]][[a]]')))
    expect(getTextblockDisplayText(fixture.doc.child(0))).toBe('a')
  })
})
