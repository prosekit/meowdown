import { pasteText } from '@prosekit/core/test'
import type { EditorView } from '@prosekit/pm/view'
import { describe, expect, it } from 'vitest'

import { docToMarkdown } from '../../converters/pm-to-md.ts'
import { setupFixture } from '../../testing/index.ts'

/**
 * Dispatch a real paste event carrying only `text/plain`. Unlike the
 * `pasteText` helper (which forces ProseMirror's plain-text flag, i.e. a
 * Shift-paste), this exercises the regular paste path. Firefox discards the
 * DataTransfer passed to the ClipboardEvent constructor, so when the text did
 * not survive, shadow the getter with the real object.
 */
function firePlainPaste(view: EditorView, text: string): void {
  const clipboardData = new DataTransfer()
  clipboardData.setData('text/plain', text)
  const event = new ClipboardEvent('paste', { clipboardData, cancelable: true })
  if (event.clipboardData?.getData('text/plain') !== text) {
    Object.defineProperty(event, 'clipboardData', { value: clipboardData })
  }
  view.dom.dispatchEvent(event)
}

function pastePlainText(text: string): string {
  using fixture = setupFixture()
  const { n, view } = fixture
  fixture.set(n.doc(n.paragraph()))
  firePlainPaste(view, text)
  return docToMarkdown(view.state.doc)
}

describe('plain text paste', () => {
  it('inserts a single line inline', () => {
    using fixture = setupFixture()
    const { n, view } = fixture
    fixture.set(n.doc(n.paragraph('before <a>after')))
    firePlainPaste(view, 'pasted')
    expect(docToMarkdown(view.state.doc)).toMatchInlineSnapshot(`
      """
      before pastedafter

      """
    `)
  })

  it('keeps a single newline as a soft break', () => {
    expect(pastePlainText('aaa\nbbb')).toMatchInlineSnapshot(`
      """
      aaa
      bbb

      """
    `)
  })

  it('does not insert an empty paragraph for one blank line', () => {
    expect(pastePlainText('aaa\n\nbbb')).toMatchInlineSnapshot(`
      """
      aaa

      bbb

      """
    `)
  })

  it('restores one gap paragraph for two blank lines', () => {
    expect(pastePlainText('aaa\n\n\nbbb')).toMatchInlineSnapshot(`
      """
      aaa


      bbb

      """
    `)
  })

  it('trims leading and trailing newlines', () => {
    expect(pastePlainText('\n\naaa\n\n')).toMatchInlineSnapshot(`
      """
      aaa

      """
    `)
  })

  it('inserts nothing for whitespace-only newlines', () => {
    expect(pastePlainText('\n\n\n')).toMatchInlineSnapshot(`
      "
      "
    `)
  })

  it('normalizes CRLF', () => {
    expect(pastePlainText('aaa\r\n\r\nbbb\r\nccc')).toMatchInlineSnapshot(`
      """
      aaa

      bbb
      ccc

      """
    `)
  })

  it('keeps tabs and spaces', () => {
    expect(pastePlainText('a\t b')).toMatchInlineSnapshot(`
      """
      a	 b

      """
    `)
  })

  it('renders pasted inline markdown source immediately', () => {
    using fixture = setupFixture()
    const { n, view } = fixture
    fixture.set(n.doc(n.paragraph()))
    firePlainPaste(view, 'a **b** c')
    expect(docToMarkdown(view.state.doc)).toMatchInlineSnapshot(`
      """
      a **b** c

      """
    `)
    expect(fixture.htmlSnapshot).toMatchInlineSnapshot(`
      "
      <p>
        a
        <span
          class="md-pack"
          data-key="bold"
        >
          <strong>
            <span class="md-mark">
              **
            </span>
            b
            <span class="md-mark">
              **
            </span>
          </strong>
        </span>
        c
      </p>
      "
    `)
  })

  it('keeps block markdown syntax as literal text', () => {
    expect(pastePlainText('# title\ntext')).toMatchInlineSnapshot(`
      """
      # title
      text

      """
    `)
  })
})

describe('plain text paste with shift', () => {
  // `pasteText` sets ProseMirror's plain-text flag, the same path a
  // Shift-paste takes: every newline run becomes a paragraph break.
  it('splits every newline run into paragraphs', () => {
    using fixture = setupFixture()
    const { n, view } = fixture
    fixture.set(n.doc(n.paragraph()))
    pasteText(view, 'aaa\nbbb\n\nccc')
    expect(docToMarkdown(view.state.doc)).toMatchInlineSnapshot(`
      """
      aaa

      bbb

      ccc

      """
    `)
  })
})
