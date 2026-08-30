import type { EditorState } from '@prosekit/pm/state'
import { describe, expect, it } from 'vitest'

import { findText } from '../testing/find-text.ts'
import { setupFixture } from '../testing/index.ts'

import { getLinkUnitAt } from './get-link-unit-at.ts'

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

  it('keeps authored Markdown when the label matches the visible text', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('see <a>**bold** docs<b> now')))
    expect(editor.commands.insertLink({ text: 'bold docs', href: 'http://x' })).toBe(true)
    expect(fixture.doc.child(0).textContent).toBe('see [**bold** docs](http://x) now')
  })

  it('replaces authored Markdown when the label is edited', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('see <a>**bold** docs<b> now')))
    expect(editor.commands.insertLink({ text: 'plain docs', href: 'http://x' })).toBe(true)
    expect(fixture.doc.child(0).textContent).toBe('see [plain docs](http://x) now')
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

  it('escapes meowdown delimiters in a new label', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('[Old](http://x)')))
    editor.commands.selectText(findText(fixture.doc, 'Old') + 1)
    editor.commands.updateLink({ text: '==hi== $x$ #tag' })
    expect(fixture.doc.child(0).textContent).toBe(String.raw`[\=\=hi\=\= \$x\$ \#tag](http://x)`)
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

/**
 * Assert no link unit remains anywhere: `textContent` alone cannot prove
 * unlinking, because re-autolinked text keeps identical source characters
 * and only the marks change.
 */
function expectNoLink(state: EditorState): void {
  for (let pos = 0; pos <= state.doc.content.size; pos++) {
    expect(getLinkUnitAt(state, pos)).toBeUndefined()
  }
}

describe('removeLink', () => {
  it('keeps the label and drops the syntax', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('a [docs](http://x) b')))
    editor.commands.selectText(findText(fixture.doc, 'docs') + 1)
    expect(editor.commands.removeLink()).toBe(true)
    expect(fixture.doc.child(0).textContent).toBe('a docs b')
  })

  it('unlinks a bare URL with a magic comment so it does not autolink again', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('see https://example.com now')))
    editor.commands.selectText(findText(fixture.doc, 'example.com') + 1)
    expect(editor.commands.removeLink()).toBe(true)
    expect(fixture.doc.child(0).textContent).toBe(
      'see https://example.com<!-- {"unlinked":true} --> now',
    )
    expectNoLink(fixture.state)
  })

  it('unlinks an angle URL while preserving its visible text', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('<https://example.com>')))
    editor.commands.selectText(findText(fixture.doc, 'example.com') + 1)
    expect(editor.commands.removeLink()).toBe(true)
    expect(fixture.doc.child(0).textContent).toBe('https://example.com<!-- {"unlinked":true} -->')
    expectNoLink(fixture.state)
  })

  it('unlinks a URL-labelled inline link', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('[google.com](https://google.com)')))
    editor.commands.selectText(findText(fixture.doc, 'google.com') + 1)
    editor.commands.removeLink()
    expect(fixture.doc.child(0).textContent).toBe('google.com<!-- {"unlinked":true} -->')
    expectNoLink(fixture.state)
  })

  it('unlinks a mailto URL so the email does not autolink again', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('mailto:a@b.com')))
    editor.commands.selectText(findText(fixture.doc, 'b.com') + 1)
    expect(editor.commands.removeLink()).toBe(true)
    expect(fixture.doc.child(0).textContent).toBe('mailto:a@b.com<!-- {"unlinked":true} -->')
    expectNoLink(fixture.state)
  })

  it('unlinks a userinfo URL so the email part does not autolink again', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('https://user@example.com')))
    editor.commands.selectText(findText(fixture.doc, 'example.com') + 1)
    expect(editor.commands.removeLink()).toBe(true)
    expect(fixture.doc.child(0).textContent).toBe(
      'https://user@example.com<!-- {"unlinked":true} -->',
    )
    expectNoLink(fixture.state)
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
