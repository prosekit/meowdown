import { pasteHTML } from '@prosekit/core/test'
import { describe, expect, it } from 'vitest'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture, type Fixture } from '../testing/index.ts'

import { defineHTMLPaste } from './html-paste.ts'

function useHTMLPaste(fixture: Fixture): void {
  fixture.editor.use(defineHTMLPaste())
}

describe('paste rich-text HTML', () => {
  it('keeps bold and italic', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useHTMLPaste(fixture)
    fixture.set(n.doc(n.paragraph('<a>')))
    pasteHTML(view, '<p>hi <strong>bold</strong> and <em>italic</em></p>')
    expect(docToMarkdown(editor.state.doc).trim()).toBe('hi **bold** and *italic*')
  })

  it('keeps a bullet list with formatted items', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useHTMLPaste(fixture)
    fixture.set(n.doc(n.paragraph('<a>')))
    pasteHTML(view, '<ul><li>one</li><li><strong>two</strong></li></ul>')
    expect(docToMarkdown(editor.state.doc).trim()).toBe('- one\n- **two**')
  })

  it('keeps a link', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useHTMLPaste(fixture)
    fixture.set(n.doc(n.paragraph('<a>')))
    pasteHTML(view, '<p>see <a href="https://x.com">link</a></p>')
    expect(docToMarkdown(editor.state.doc).trim()).toBe('see [link](https://x.com)')
  })

  it('replaces the selection when pasting onto it', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useHTMLPaste(fixture)
    fixture.set(n.doc(n.paragraph('<a>drop me<b>')))
    pasteHTML(view, '<p><strong>kept</strong></p>')
    expect(docToMarkdown(editor.state.doc).trim()).toBe('**kept**')
  })

  it('pastes plain text inside a code block without converting', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useHTMLPaste(fixture)
    fixture.set(n.doc(n.codeBlock('<a>')))
    pasteHTML(view, '<p><strong>bold</strong></p>')
    // The handler bails; the default path inserts the HTML's text, no `**`.
    expect(editor.state.doc.textContent).not.toContain('**')
  })

  it('leaves meowdown-native clipboard HTML to the default path', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useHTMLPaste(fixture)
    fixture.set(n.doc(n.paragraph('<a>')))
    pasteHTML(
      view,
      '<p data-md="x **b** y" data-meowdown="" data-pm-slice="1 1 []">x <strong>b</strong> y</p>',
    )
    expect(docToMarkdown(editor.state.doc).trim()).toBe('x **b** y')
  })

  it('leaves clipboard HTML from an older meowdown to the default path', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useHTMLPaste(fixture)
    fixture.set(n.doc(n.paragraph('<a>')))
    // Pre-`data-meowdown` clipboard HTML: the editor DOM with `md-mark` spans.
    pasteHTML(
      view,
      '<div data-pm-slice="1 1 []"><p><span class="md-mark">**</span>b<span class="md-mark">**</span></p></div>',
    )
    expect(docToMarkdown(editor.state.doc).trim()).toBe('**b**')
  })

  it('converts HTML from a foreign ProseMirror editor', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useHTMLPaste(fixture)
    fixture.set(n.doc(n.paragraph('<a>')))
    // A foreign PM editor writes `data-pm-slice` without any meowdown signature;
    // its semantic tags must convert to markdown instead of losing the format.
    pasteHTML(view, '<div data-pm-slice="1 1 []"><p>x <strong>b</strong> y</p></div>')
    expect(docToMarkdown(editor.state.doc).trim()).toBe('x **b** y')
  })
})
