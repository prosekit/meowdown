import { describe, expect, it } from 'vitest'

import { findText } from '../testing/find-text.ts'
import { setupFixture } from '../testing/index.ts'

describe('insertLink', () => {
  it('wraps the selection as a link', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('see <a>docs<b> here')))
    expect(editor.commands.insertLink({ href: 'http://x' })).toBe(true)
    expect(fixture.doc.child(0).textContent).toBe('see [docs](http://x) here')
  })

  it('normalizes a bare host and writes a title', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('<a>docs<b>')))
    editor.commands.insertLink({ href: 'example.com', title: 'T' })
    expect(fixture.doc.child(0).textContent).toBe('[docs](https://example.com "T")')
  })

  it('refuses on an empty selection', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('docs')))
    expect(editor.commands.insertLink({ href: 'http://x' })).toBe(false)
  })
})

describe('updateLink', () => {
  it('rewrites the href in place', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('[docs](http://old)')))
    editor.commands.selectText(findText(fixture.doc, 'docs') + 1)
    expect(editor.commands.updateLink({ href: 'http://new' })).toBe(true)
    expect(fixture.doc.child(0).textContent).toBe('[docs](http://new)')
  })

  it('adds a title without changing the href', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('[docs](http://x)')))
    editor.commands.selectText(findText(fixture.doc, 'docs') + 1)
    editor.commands.updateLink({ title: 'T' })
    expect(fixture.doc.child(0).textContent).toBe('[docs](http://x "T")')
  })

  it('refuses on an autolink', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('see https://example.com now')))
    editor.commands.selectText(findText(fixture.doc, 'example.com') + 1)
    expect(editor.commands.updateLink({ href: 'http://x' })).toBe(false)
  })
})

describe('removeLink', () => {
  it('keeps the label and drops the syntax', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('a [docs](http://x) b')))
    editor.commands.selectText(findText(fixture.doc, 'docs') + 1)
    expect(editor.commands.removeLink()).toBe(true)
    expect(fixture.doc.child(0).textContent).toBe('a docs b')
  })

  it('refuses on an autolink', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('see https://example.com now')))
    editor.commands.selectText(findText(fixture.doc, 'example.com') + 1)
    expect(editor.commands.removeLink()).toBe(false)
  })
})
