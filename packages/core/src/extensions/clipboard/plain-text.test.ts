import { TextSelection } from '@prosekit/pm/state'
import { describe, expect, it } from 'vitest'

import { markdownToDoc } from '../../converters/md-to-pm.ts'
import { setupFixture, type Fixture } from '../../testing/index.ts'
import type { MarkMode } from '../mark-mode.ts'

function setupPlainText(mode: MarkMode, markdown: string): Fixture {
  const fixture = setupFixture({ extensionOptions: { markMode: mode } })
  const { editor } = fixture
  fixture.set(markdownToDoc(markdown, { nodes: editor.nodes }))
  return fixture
}

/** The `text/plain` flavor of a whole-document block copy. */
function copyText(mode: MarkMode, markdown: string): string {
  using fixture = setupPlainText(mode, markdown)
  const { view } = fixture
  const doc = view.state.doc
  return view.serializeForClipboard(doc.slice(0, doc.content.size)).text
}

/** The `text/plain` flavor of an inline selection inside one paragraph. */
function copySelectionText(mode: MarkMode, markdown: string, from: number, to: number): string {
  using fixture = setupPlainText(mode, markdown)
  const { view } = fixture
  const selection = TextSelection.create(view.state.doc, from, to)
  view.dispatch(view.state.tr.setSelection(selection))
  return view.serializeForClipboard(view.state.selection.content()).text
}

describe('plain text copy in show and focus mode', () => {
  it('keeps the full inline source in show mode', () => {
    expect(copyText('show', 'a *b* **c** `d`')).toMatchInlineSnapshot(`"a *b* **c** \`d\`"`)
  })

  it('keeps the full inline source in focus mode', () => {
    expect(copyText('focus', 'a *b* **c** `d`')).toMatchInlineSnapshot(`"a *b* **c** \`d\`"`)
  })

  it('emits block markers for a heading and a list', () => {
    expect(copyText('show', '### title\n\n- one\n  - two')).toMatchInlineSnapshot(`
      "### title

      - one
        - two"
    `)
  })

  it('emits blockquote and fence markers', () => {
    expect(copyText('show', '> quote\n\n```js\ncode\n```')).toMatchInlineSnapshot(`
      "> quote

      \`\`\`js
      code
      \`\`\`"
    `)
  })

  it('keeps a partial paragraph selection as inline source', () => {
    // 2..16 covers `lain **bold** e` inside `plain **bold** end`
    expect(copySelectionText('show', 'plain **bold** end', 2, 16)).toMatchInlineSnapshot(
      `"lain **bold**"`,
    )
  })
})

describe('plain text copy in hide mode', () => {
  it('strips emphasis syntax but keeps block markers', () => {
    expect(copyText('hide', '### a **b**\n\n- item *x*')).toMatchInlineSnapshot(`
      "### a b

      - item x"
    `)
  })

  it('keeps blockquote structure with stripped inline syntax', () => {
    expect(copyText('hide', '> x **y**\n>\n> z')).toMatchInlineSnapshot(`
      "> x y
      >
      > z"
    `)
  })

  it('keeps table structure with stripped inline syntax', () => {
    expect(copyText('hide', '| a | b |\n| - | - |\n| **1** | 2 |')).toMatchInlineSnapshot(`
      "| a | b |
      | --- | --- |
      | 1 | 2 |"
    `)
  })

  it('keeps bullet list markers', () => {
    expect(copyText('hide', '- one **b**\n- two')).toMatchInlineSnapshot(`
      "- one b
      - two"
    `)
  })

  it('keeps ordered list markers', () => {
    expect(copyText('hide', '1. first *x*\n2. second')).toMatchInlineSnapshot(`
      "1. first x
      2. second"
    `)
  })

  it('keeps task checkboxes in all shapes', () => {
    expect(copyText('hide', '- [ ] open\n- [x] done\n+ [ ] round open\n+ [x] round done'))
      .toMatchInlineSnapshot(`
      "- [ ] open
      - [x] done
      + [ ] round open
      + [x] round done"
    `)
  })

  it('keeps a nested list shape', () => {
    expect(copyText('hide', '- parent *x*\n  1. one\n  2. two\n- tail')).toMatchInlineSnapshot(`
      "- parent x
        1. one
        2. two
      - tail"
    `)
  })

  it('strips link syntax down to the label', () => {
    expect(copyText('hide', 'see [docs](http://x.test)')).toMatchInlineSnapshot(`"see docs"`)
  })

  it('keeps a bare autolink', () => {
    expect(copyText('hide', 'visit https://example.com now')).toMatchInlineSnapshot(
      `"visit https://example.com now"`,
    )
  })

  it('keeps the whole image source', () => {
    expect(copyText('hide', 'see ![cat](https://example.com/cat.png) end')).toMatchInlineSnapshot(
      `"see ![cat](https://example.com/cat.png) end"`,
    )
  })

  it('keeps the whole math source', () => {
    expect(copyText('hide', 'see $E=mc^2$ end')).toMatchInlineSnapshot(`"see $E=mc^2$ end"`)
  })

  it('replaces a wikilink with its target', () => {
    expect(copyText('hide', 'see [[note]] end')).toMatchInlineSnapshot(`"see note end"`)
  })

  it('replaces a wikilink with its display alias', () => {
    expect(copyText('hide', 'see [[note|alias]] end')).toMatchInlineSnapshot(`"see alias end"`)
  })

  it('keeps a tag verbatim', () => {
    expect(copyText('hide', 'Hello #meow end')).toMatchInlineSnapshot(`"Hello #meow end"`)
  })

  it('strips syntax from a partial paragraph selection', () => {
    expect(copySelectionText('hide', 'plain **bold** end', 2, 16)).toMatchInlineSnapshot(
      `"lain bold"`,
    )
  })

  it('keeps code block content verbatim', () => {
    expect(copyText('hide', '```js\nconst asterisks = "**"\n```')).toMatchInlineSnapshot(`
      "\`\`\`js
      const asterisks = "**"
      \`\`\`"
    `)
  })
})

describe('plain text copy block layout', () => {
  it('separates paragraphs with a blank line', () => {
    expect(copyText('show', 'aaa\n\nbbb')).toMatchInlineSnapshot(`
      "aaa

      bbb"
    `)
  })

  it('keeps gap paragraphs as extra blank lines', () => {
    expect(copyText('show', 'aaa\n\n\n\nbbb')).toMatchInlineSnapshot(`
      "aaa



      bbb"
    `)
  })

  it('keeps a soft break inside a paragraph', () => {
    expect(copyText('show', 'line1\nline2')).toMatchInlineSnapshot(`
      "line1
      line2"
    `)
  })
})
