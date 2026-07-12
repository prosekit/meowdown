import { pasteHTML } from '@prosekit/core/test'
import { TextSelection } from '@prosekit/pm/state'
import { formatHTML } from 'diffable-html-snapshot'
import { describe, expect, it } from 'vitest'

import { markdownToDoc } from '../../converters/md-to-pm.ts'
import { docToMarkdown } from '../../converters/pm-to-md.ts'
import { setupFixture, type Fixture } from '../../testing/index.ts'

/**
 * The clipboard HTML of the whole document as a closed slice: the shape a
 * block copy (e.g. a block handle drag) produces, where `transformCopied`
 * (`unwrapListSlice`) does not fire.
 */
function captureClipboardHTML(fixture: Fixture, markdown: string): string {
  const { editor, view } = fixture
  fixture.set(markdownToDoc(markdown, { nodes: editor.nodes }))
  const doc = view.state.doc
  return view.serializeForClipboard(doc.slice(0, doc.content.size)).dom.innerHTML
}

/** The clipboard HTML of a select-all text selection, `transformCopied` included. */
function captureSelectionHTML(fixture: Fixture, markdown: string): string {
  const { editor, view } = fixture
  fixture.set(markdownToDoc(markdown, { nodes: editor.nodes }))
  const doc = view.state.doc
  const selection = TextSelection.between(doc.resolve(0), doc.resolve(doc.content.size))
  view.dispatch(view.state.tr.setSelection(selection))
  return view.serializeForClipboard(view.state.selection.content()).dom.innerHTML
}

function pasteIntoEmptyDoc(html: string): string {
  using target = setupFixture()
  const { n, view } = target
  target.set(n.doc(n.paragraph()))
  pasteHTML(view, html)
  return docToMarkdown(view.state.doc)
}

function roundTrip(markdown: string): string {
  using source = setupFixture()
  return pasteIntoEmptyDoc(captureClipboardHTML(source, markdown))
}

describe('clipboard HTML', () => {
  it('serializes a document to semantic HTML', () => {
    using fixture = setupFixture()
    const html = captureClipboardHTML(fixture, '## Title\n\nplain **bold** text')
    expect(formatHTML(html)).toMatchInlineSnapshot(`
      "
      <h2
        data-md="Title"
        data-meowdown
        data-pm-slice="0 0 []"
      >
        Title
      </h2>
      <p
        data-md="plain **bold** text"
        data-meowdown
      >
        plain
        <strong>
          bold
        </strong>
        text
      </p>
      "
    `)
  })

  it('stamps data-meowdown on every top-level element', () => {
    using fixture = setupFixture()
    const html = captureClipboardHTML(fixture, '- one\n- two\n\n```js\ncode\n```')
    expect(formatHTML(html)).toMatchInlineSnapshot(`
      "
      <ul
        data-meowdown
        data-pm-slice="0 0 []"
      >
        <li
          class="prosemirror-flat-list"
          data-list-kind="bullet"
        >
          <p
            data-md="one"
            data-meowdown
          >
            one
          </p>
        </li>
        <li
          class="prosemirror-flat-list"
          data-list-kind="bullet"
        >
          <p
            data-md="two"
            data-meowdown
          >
            two
          </p>
        </li>
      </ul>
      <pre
        data-language="js"
        data-meowdown
      >
        <code class="language-js">
          code
        </code>
      </pre>
      "
    `)
  })
})

describe('clipboard round trip', () => {
  it('round-trips a heading with inline marks', () => {
    expect(roundTrip('### a **b** `c`')).toMatchInlineSnapshot(`
      "### a **b** \`c\`
      "
    `)
  })

  it('round-trips a setext heading', () => {
    expect(roundTrip('title\n=====')).toMatchInlineSnapshot(`
      "title
      =====
      "
    `)
  })

  it('round-trips a heading with closing hashes', () => {
    expect(roundTrip('## title ##')).toMatchInlineSnapshot(`
      "## title ##
      "
    `)
  })

  it('round-trips a nested list', () => {
    expect(roundTrip('- parent\n  - child')).toMatchInlineSnapshot(`
      "- parent
        - child
      "
    `)
  })

  it('round-trips a round task', () => {
    expect(roundTrip('+ [ ] Task')).toMatchInlineSnapshot(`
      "+ [ ] Task
      "
    `)
  })

  it('round-trips a blockquote with two paragraphs', () => {
    expect(roundTrip('> one\n>\n> two')).toMatchInlineSnapshot(`
      "> one
      >
      > two
      "
    `)
  })

  it('round-trips a fenced code block', () => {
    expect(roundTrip('~~~~js\nconst x = 1\n~~~~')).toMatchInlineSnapshot(`
      "~~~~js
      const x = 1
      ~~~~
      "
    `)
  })

  it('round-trips a table', () => {
    expect(roundTrip('| a | b |\n| :-: | - |\n| 1 | 2 |')).toMatchInlineSnapshot(`
      "| a | b |
      | :-: | --- |
      | 1 | 2 |
      "
    `)
  })

  it('round-trips an ordered list', () => {
    expect(roundTrip('1. first\n2. second')).toMatchInlineSnapshot(`
      "1. first
      2. second
      "
    `)
  })

  it('round-trips a thematic break with a non-canonical marker', () => {
    expect(roundTrip('before\n\n* * *\n\nafter')).toMatchInlineSnapshot(`
      "before

      * * *

      after
      "
    `)
  })

  it('round-trips an html comment', () => {
    expect(roundTrip('before\n\n<!-- note -->\n\nafter')).toMatchInlineSnapshot(`
      "before

      <!-- note -->

      after
      "
    `)
  })

  it('round-trips gap paragraphs', () => {
    expect(roundTrip('aaa\n\n\n\nbbb')).toMatchInlineSnapshot(`
      "aaa



      bbb
      "
    `)
  })

  it('round-trips a wikilink with a display alias', () => {
    expect(roundTrip('see [[note|alias]] end')).toMatchInlineSnapshot(`
      "see [[note|alias]] end
      "
    `)
  })

  it('round-trips an inline image', () => {
    expect(roundTrip('see ![cat](https://example.com/cat.png) end')).toMatchInlineSnapshot(`
      "see ![cat](https://example.com/cat.png) end
      "
    `)
  })

  it('round-trips inline math', () => {
    expect(roundTrip('see $E=mc^2$ end')).toMatchInlineSnapshot(`
      "see $E=mc^2$ end
      "
    `)
  })

  it('round-trips a soft break inside a paragraph', () => {
    expect(roundTrip('line1\nline2')).toMatchInlineSnapshot(`
      "line1
      line2
      "
    `)
  })
})

describe('selection copy', () => {
  // Selecting everything inside a single list item is "a selection within one
  // item", so flat-list's `unwrapListSlice` intentionally strips the list
  // wrapper: pasting into another item must not create a nested list.
  it('unwraps a single task item into plain text', () => {
    using source = setupFixture()
    const html = captureSelectionHTML(source, '+ [ ] Task')
    expect(html).toMatchInlineSnapshot(
      `"<p data-md="Task" data-meowdown="" data-pm-slice="1 1 []">Task</p>"`,
    )
    expect(pasteIntoEmptyDoc(html)).toMatchInlineSnapshot(`
      "Task
      "
    `)
  })

  it('keeps sibling items as a list', () => {
    using source = setupFixture()
    expect(pasteIntoEmptyDoc(captureSelectionHTML(source, '- one\n- two'))).toMatchInlineSnapshot(`
      "- one
      - two
      "
    `)
  })

  it('keeps inline marks in a partial paragraph selection', () => {
    using source = setupFixture()
    const { editor, view } = source
    source.set(markdownToDoc('plain **bold** end', { nodes: editor.nodes }))
    // 1..15 covers `lain **bold** e` inside the paragraph
    const selection = TextSelection.create(view.state.doc, 2, 16)
    view.dispatch(view.state.tr.setSelection(selection))
    const html = view.serializeForClipboard(view.state.selection.content()).dom.innerHTML
    expect(html).toMatchInlineSnapshot(
      `"<p data-md="lain **bold** " data-meowdown="" data-pm-slice="1 1 []">lain <strong>bold</strong> </p>"`,
    )
    expect(pasteIntoEmptyDoc(html)).toMatchInlineSnapshot(`
      "lain **bold**
      "
    `)
  })
})
