import { describe, expect, it } from 'vitest'

import { findText } from '../testing/find-text.ts'
import { setupFixture } from '../testing/index.ts'

import { linkAt, wikilinkAt } from './link-hit.ts'

describe('wikilinkAt', () => {
  it('spans the whole [[target]] and reports the target', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('See [[Charlotte]] here.')))

    const pos = findText(fixture.doc, 'Charlotte') + 1
    const hit = wikilinkAt(fixture.state, pos)
    expect(hit).toBeTruthy()
    expect(hit!.target).toBe('Charlotte')
    expect(hit!.display).toBe('Charlotte')
    expect(fixture.doc.textBetween(hit!.from, hit!.to)).toBe('[[Charlotte]]')
  })

  it('splits target and display on the first pipe', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('go [[Project X|the project]] now')))

    const pos = findText(fixture.doc, 'the project') + 1
    const hit = wikilinkAt(fixture.state, pos)
    expect(hit!.target).toBe('Project X')
    expect(hit!.display).toBe('the project')
    expect(hit!.raw).toBe('Project X|the project')
  })

  it('resolves adjacent links independently', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('x [[aaa]][[bbb]] y')))

    expect(wikilinkAt(fixture.state, findText(fixture.doc, 'aaa') + 1)!.target).toBe('aaa')
    expect(wikilinkAt(fixture.state, findText(fixture.doc, 'bbb') + 1)!.target).toBe('bbb')
  })

  it('returns null outside any wikilink', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('See [[Charlotte]] here.')))

    expect(wikilinkAt(fixture.state, findText(fixture.doc, 'here') + 1)).toBe(null)
  })

  it('returns null inside a code block', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock({ language: '' }, '[[Charlotte]]')))

    expect(wikilinkAt(fixture.state, findText(fixture.doc, 'Charlotte') + 1)).toBe(null)
  })

  it('returns null inside a code span', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('pre `[[Charlotte]]` post')))

    expect(wikilinkAt(fixture.state, findText(fixture.doc, 'Charlotte') + 1)).toBe(null)
  })

  it('returns null for an empty target', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('a [[ |alias]] b')))

    expect(wikilinkAt(fixture.state, findText(fixture.doc, 'alias') + 1)).toBe(null)
  })
})

describe('linkAt', () => {
  it('reports the href and text of a Markdown link', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('see [docs](http://x.test) end')))

    const pos = findText(fixture.doc, 'docs') + 1
    const hit = linkAt(fixture.state, pos)
    expect(hit).toBeTruthy()
    expect(hit!.href).toBe('http://x.test')
    expect(hit!.text).toBe('docs')
    expect(fixture.doc.textBetween(hit!.from, hit!.to)).toBe('docs')
  })

  it('returns null off any link', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('see [docs](http://x.test) end')))

    expect(linkAt(fixture.state, findText(fixture.doc, 'see') + 1)).toBe(null)
  })

  it('returns null inside a code block', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock({ language: '' }, '[docs](http://x.test)')))

    expect(linkAt(fixture.state, findText(fixture.doc, 'docs') + 1)).toBe(null)
  })
})
