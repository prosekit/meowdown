import { describe, expect, it } from 'vitest'

import { findText } from '../testing/find-text.ts'
import { setupFixture } from '../testing/index.ts'

import { getLinkUnitAt } from './get-link-unit-at.ts'

describe('getLinkUnitAt', () => {
  it('resolves href, label, and dest for a plain link', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('see [docs](http://example.com) here')))
    const link = getLinkUnitAt(fixture.state, findText(fixture.doc, 'docs') + 1)!
    expect(link.href).toBe('http://example.com')
    expect(link.title).toBe('')
    expect(fixture.doc.textBetween(link.unit.from, link.unit.to)).toBe('[docs](http://example.com)')
    expect(fixture.doc.textBetween(link.label!.from, link.label!.to)).toBe('docs')
    expect(fixture.doc.textBetween(link.dest!.from, link.dest!.to)).toBe('http://example.com')
  })

  it('parses and unquotes a title', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('[docs](http://x "the title")')))
    const link = getLinkUnitAt(fixture.state, findText(fixture.doc, 'docs') + 1)!
    expect(link.href).toBe('http://x')
    expect(link.title).toBe('the title')
    expect(fixture.doc.textBetween(link.dest!.from, link.dest!.to)).toBe('http://x "the title"')
  })

  it('resolves href when the position is on the url run, not the label', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('[docs](http://example.com)')))
    const link = getLinkUnitAt(fixture.state, findText(fixture.doc, 'example.com') + 1)!
    expect(link.href).toBe('http://example.com')
    expect(fixture.doc.textBetween(link.label!.from, link.label!.to)).toBe('docs')
  })

  it('returns the right href when two links touch', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('[a](http://a.test)[b](http://b.test)')))
    expect(getLinkUnitAt(fixture.state, findText(fixture.doc, 'a') + 1)!.href).toBe('http://a.test')
    expect(getLinkUnitAt(fixture.state, findText(fixture.doc, 'b') + 1)!.href).toBe('http://b.test')
  })

  it('treats an autolink as href-only (no label or dest)', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('visit https://example.com now')))
    const link = getLinkUnitAt(fixture.state, findText(fixture.doc, 'example.com') + 1)!
    expect(link.href).toBe('https://example.com')
    expect(link.label).toBeUndefined()
    expect(link.dest).toBeUndefined()
  })

  it('handles an empty dest', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('[docs]()')))
    const link = getLinkUnitAt(fixture.state, findText(fixture.doc, 'docs') + 1)!
    expect(link.href).toBe('')
    expect(link.dest!.from).toBe(link.dest!.to)
    expect(fixture.doc.textBetween(link.label!.from, link.label!.to)).toBe('docs')
  })

  it('returns undefined in plain text', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('plain text')))
    expect(getLinkUnitAt(fixture.state, findText(fixture.doc, 'plain') + 1)).toBeUndefined()
  })
})
