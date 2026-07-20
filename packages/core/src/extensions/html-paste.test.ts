import { pasteHTML } from '@prosekit/core/test'
import { describe, expect, it } from 'vitest'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture } from '../testing/index.ts'

describe('paste rich-text HTML', () => {
  it('keeps bold and italic', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))
    pasteHTML(view, '<p>hi <strong>bold</strong> and <em>italic</em></p>')
    expect(docToMarkdown(editor.state.doc).trim()).toBe('hi **bold** and *italic*')
  })

  it('keeps a bullet list with formatted items', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))
    pasteHTML(view, '<ul><li>one</li><li><strong>two</strong></li></ul>')
    expect(docToMarkdown(editor.state.doc).trim()).toBe('- one\n- **two**')
  })

  it('keeps a link', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))
    pasteHTML(view, '<p>see <a href="https://x.com">link</a></p>')
    expect(docToMarkdown(editor.state.doc).trim()).toBe('see [link](https://x.com)')
  })

  it('replaces the selection when pasting onto it', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    fixture.set(n.doc(n.paragraph('<a>drop me<b>')))
    pasteHTML(view, '<p><strong>kept</strong></p>')
    expect(docToMarkdown(editor.state.doc).trim()).toBe('**kept**')
  })

  it('pastes plain text inside a code block without converting', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    fixture.set(n.doc(n.codeBlock('<a>')))
    pasteHTML(view, '<p><strong>bold</strong></p>')
    // The handler bails; the default path inserts the HTML's text, no `**`.
    expect(editor.state.doc.textContent).not.toContain('**')
  })

  it('leaves meowdown-native clipboard HTML to the default path', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
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
    fixture.set(n.doc(n.paragraph('<a>')))
    // A foreign PM editor writes `data-pm-slice` without any meowdown signature;
    // its semantic tags must convert to markdown instead of losing the format.
    pasteHTML(view, '<div data-pm-slice="1 1 []"><p>x <strong>b</strong> y</p></div>')
    expect(docToMarkdown(editor.state.doc).trim()).toBe('x **b** y')
  })

  it('converts a foreign task list into a meowdown task list', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))
    pasteHTML(
      view,
      '<ul data-type="taskList">' +
        '<li data-checked="false" data-type="taskItem"><label><input type="checkbox"></label><div><p>one</p></div></li>' +
        '<li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked></label><div><p>two</p></div></li>' +
        '</ul>',
    )
    expect(docToMarkdown(editor.state.doc).trim()).toBe('- [ ] one\n- [x] two')
    expect(editor.state.doc.firstChild?.attrs.kind).toBe('task')
  })
})

describe('paste styled plain text', () => {
  it('pastes code-editor line divs as markdown source', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))
    // VS Code wraps each copied source line in a styled div/span; the text is
    // markdown source and must not be escaped by the HTML conversion.
    pasteHTML(
      view,
      '<meta charset="utf-8"><div style="color:#abb2bf"><span>- [ ] one</span></div><div><span>- [x] two</span></div>',
    )
    expect(docToMarkdown(editor.state.doc).trim()).toBe('- [ ] one\n- [x] two')
    expect(editor.state.doc.firstChild?.attrs.kind).toBe('task')
  })

  it('keeps markdown punctuation in styled prose unescaped', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))
    pasteHTML(view, '<p>[foo] and ~5 items and `code`</p>')
    expect(docToMarkdown(editor.state.doc).trim()).toBe('[foo] and ~5 items and `code`')
  })

  it('keeps blank-line structure from line divs', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))
    pasteHTML(view, '<div>aaa</div><div><br></div><div>bbb</div>')
    expect(docToMarkdown(editor.state.doc)).toBe('aaa\n\nbbb\n')
  })

  it('separates paragraphs from p tags', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))
    pasteHTML(view, '<p>aaa</p><p>bbb</p>')
    expect(docToMarkdown(editor.state.doc)).toBe('aaa\n\nbbb\n')
  })
})
