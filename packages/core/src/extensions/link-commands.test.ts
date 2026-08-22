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

  it('updates the label while preserving the CommonMark title', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('[Old](http://x "Tooltip")')))
    editor.commands.selectText(findText(fixture.doc, 'Old') + 1)
    expect(editor.commands.updateLink({ text: 'New' })).toBe(true)
    expect(fixture.doc.child(0).textContent).toBe('[New](http://x "Tooltip")')
  })

  it('escapes special characters in a new label', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('[Old](http://x)')))
    editor.commands.selectText(findText(fixture.doc, 'Old') + 1)
    editor.commands.updateLink({ text: String.raw`a[b]\c *d* <e> &copy;` })
    expect(fixture.doc.child(0).textContent).toBe(
      String.raw`[a\[b\]\\c \*d\* \<e> \&copy;](http://x)`,
    )
  })

  it('promotes a bare autolink to an inline link', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('see https://example.com now')))
    editor.commands.selectText(findText(fixture.doc, 'example.com') + 1)
    expect(editor.commands.updateLink({ text: 'Example', href: 'http://x' })).toBe(true)
    expect(fixture.doc.child(0).textContent).toBe('see [Example](http://x) now')
  })

  it('promotes an angle autolink to an inline link', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('<https://example.com>')))
    editor.commands.selectText(findText(fixture.doc, 'example.com') + 1)
    expect(editor.commands.updateLink({ text: 'Example' })).toBe(true)
    expect(fixture.doc.child(0).textContent).toBe('[Example](https://example.com)')
  })

  it('updates in one undoable transaction', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('https://example.com')))
    editor.commands.selectText(findText(fixture.doc, 'example.com') + 1)
    editor.commands.updateLink({ text: 'Example' })
    expect(editor.commands.undo()).toBe(true)
    expect(fixture.doc.child(0).textContent).toBe('https://example.com')
  })

  it('does not rewrite a reference', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('[Docs][doc]'), n.paragraph('[doc]: /old')))
    editor.commands.selectText(findText(fixture.doc, 'Docs') + 1)

    expect(editor.commands.updateLink({ href: '/new' })).toBe(false)
    expect(fixture.doc.textContent).toContain('[Docs][doc]')
    expect(fixture.doc.textContent).toContain('[doc]: /old')
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

  it('escapes a bare URL so it does not autolink again', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('see https://example.com now')))
    editor.commands.selectText(findText(fixture.doc, 'example.com') + 1)
    expect(editor.commands.removeLink()).toBe(true)
    expect(fixture.doc.child(0).textContent).toBe(String.raw`see https\://example.com now`)
  })

  it('escapes an angle URL while preserving its visible text', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('<https://example.com>')))
    editor.commands.selectText(findText(fixture.doc, 'example.com') + 1)
    expect(editor.commands.removeLink()).toBe(true)
    expect(fixture.doc.child(0).textContent).toBe(String.raw`https\://example.com`)
  })

  it('escapes a URL-labelled inline link', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('[google.com](https://google.com)')))
    editor.commands.selectText(findText(fixture.doc, 'google.com') + 1)
    editor.commands.removeLink()
    expect(fixture.doc.child(0).textContent).toBe(String.raw`google\.com`)
  })

  it('removes in one undoable transaction', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('https://example.com')))
    editor.commands.selectText(findText(fixture.doc, 'example.com') + 1)
    editor.commands.removeLink()
    expect(editor.commands.undo()).toBe(true)
    expect(fixture.doc.child(0).textContent).toBe('https://example.com')
  })

  it('does not unwrap a reference', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('[Docs][doc]'), n.paragraph('[doc]: /old')))
    editor.commands.selectText(findText(fixture.doc, 'Docs') + 1)

    expect(editor.commands.removeLink()).toBe(false)
    expect(fixture.doc.textContent).toContain('[Docs][doc]')
  })
})
