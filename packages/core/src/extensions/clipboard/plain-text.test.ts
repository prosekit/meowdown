import { readClipboard } from '@meowdown/vitest/clipboard'
import type { EditorNode } from '@prosekit/pm/model'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

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

/** The `text/plain` flavor of the selection marked by `<a>` and `<b>`. */
function copySelectionText(mode: MarkMode, createDoc: (n: Fixture['n']) => EditorNode): string {
  using fixture = setupFixture({ extensionOptions: { markMode: mode } })
  const { view } = fixture
  fixture.set(createDoc(fixture.n))
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
      """
      ### title

      - one
        - two
      """
    `)
  })

  it('emits blockquote and fence markers', () => {
    expect(copyText('show', '> quote\n\n```js\ncode\n```')).toMatchInlineSnapshot(`
      """
      > quote

      \`\`\`js
      code
      \`\`\`
      """
    `)
  })

  it('keeps a partial paragraph selection as inline source', () => {
    expect(
      copySelectionText('show', (n) => n.doc(n.paragraph('p<a>lain **bold**<b> end'))),
    ).toMatchInlineSnapshot(`"lain **bold**"`)
  })

  it('copies part of a heading without its marker in focus mode', () => {
    expect(
      copySelectionText('focus', (n) => n.doc(n.heading({ level: 1 }, 'alpha <a>beta<b>'))),
    ).toBe('beta')
  })

  it('copies part of a heading without its marker in show mode', () => {
    expect(
      copySelectionText('show', (n) => n.doc(n.heading({ level: 1 }, 'alpha <a>beta<b>'))),
    ).toBe('beta')
  })

  it('copies part of a code block without its fence in focus mode', () => {
    expect(
      copySelectionText('focus', (n) =>
        n.doc(n.codeBlock({ language: 'typescript' }, 'const <a>value<b> = 1')),
      ),
    ).toBe('value')
  })

  it('copies part of a code block without its fence in show mode', () => {
    expect(
      copySelectionText('show', (n) =>
        n.doc(n.codeBlock({ language: 'typescript' }, 'const <a>value<b> = 1')),
      ),
    ).toBe('value')
  })

  it('keeps newlines inside a partial code block selection', () => {
    expect(
      copySelectionText('focus', (n) =>
        n.doc(n.codeBlock({ language: 'ts' }, 'line <a>one\nline<b> two')),
      ),
    ).toBe('one\nline')
  })

  it('keeps the first marker when only the last heading is partial', () => {
    expect(
      copySelectionText('focus', (n) =>
        n.doc(
          n.heading({ level: 1 }, '<a>Heading A'),
          n.paragraph('Paragraph B'),
          n.heading({ level: 2 }, 'Heading<b> C'),
        ),
      ),
    ).toBe('# Heading A\n\nParagraph B\n\nHeading')
  })

  it('drops both markers when both edge headings are partial', () => {
    expect(
      copySelectionText('focus', (n) =>
        n.doc(
          n.heading({ level: 1 }, 'Heading <a>A'),
          n.paragraph('Paragraph B'),
          n.heading({ level: 2 }, 'Heading<b> C'),
        ),
      ),
    ).toBe('A\n\nParagraph B\n\nHeading')
  })

  it('keeps both markers when both edge headings are complete', () => {
    expect(
      copySelectionText('focus', (n) =>
        n.doc(
          n.heading({ level: 1 }, '<a>Heading A'),
          n.paragraph('Paragraph B'),
          n.heading({ level: 2 }, 'Heading C<b>'),
        ),
      ),
    ).toBe('# Heading A\n\nParagraph B\n\n## Heading C')
  })

  it('keeps a heading marker when all of its content is selected', () => {
    expect(
      copySelectionText('focus', (n) => n.doc(n.heading({ level: 1 }, '<a>alpha beta<b>'))),
    ).toBe('# alpha beta')
  })
})

describe('plain text copy in hide mode', () => {
  it('strips emphasis syntax but keeps block markers', () => {
    expect(copyText('hide', '### a **b**\n\n- item *x*')).toMatchInlineSnapshot(`
      """
      ### a b

      - item x
      """
    `)
  })

  it('keeps blockquote structure with stripped inline syntax', () => {
    expect(copyText('hide', '> x **y**\n>\n> z')).toMatchInlineSnapshot(`
      """
      > x y
      >
      > z
      """
    `)
  })

  it('keeps table structure with stripped inline syntax', () => {
    expect(copyText('hide', '| a | b |\n| - | - |\n| **1** | 2 |')).toMatchInlineSnapshot(`
      """
      | a | b |
      | --- | --- |
      | 1 | 2 |
      """
    `)
  })

  it('keeps bullet list markers', () => {
    expect(copyText('hide', '- one **b**\n- two')).toMatchInlineSnapshot(`
      """
      - one b
      - two
      """
    `)
  })

  it('keeps ordered list markers', () => {
    expect(copyText('hide', '1. first *x*\n2. second')).toMatchInlineSnapshot(`
      """
      1. first x
      2. second
      """
    `)
  })

  it('keeps task checkboxes in all shapes', () => {
    expect(copyText('hide', '- [ ] open\n- [x] done\n+ [ ] round open\n+ [x] round done'))
      .toMatchInlineSnapshot(`
        """
        - [ ] open
        - [x] done
        + [ ] round open
        + [x] round done
        """
      `)
  })

  it('keeps a nested list shape', () => {
    expect(copyText('hide', '- parent *x*\n  1. one\n  2. two\n- tail')).toMatchInlineSnapshot(`
      """
      - parent x
        1. one
        2. two
      - tail
      """
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
    expect(
      copySelectionText('hide', (n) => n.doc(n.paragraph('p<a>lain **bold**<b> end'))),
    ).toMatchInlineSnapshot(`"lain bold"`)
  })

  it('copies part of a heading without its marker', () => {
    expect(
      copySelectionText('hide', (n) => n.doc(n.heading({ level: 1 }, 'alpha <a>beta<b>'))),
    ).toBe('beta')
  })

  it('copies part of a code block without its fence', () => {
    expect(
      copySelectionText('hide', (n) =>
        n.doc(n.codeBlock({ language: 'typescript' }, 'const <a>value<b> = 1')),
      ),
    ).toBe('value')
  })

  it('keeps code block content verbatim', () => {
    expect(copyText('hide', '```js\nconst asterisks = "**"\n```')).toMatchInlineSnapshot(`
      """
      \`\`\`js
      const asterisks = "**"
      \`\`\`
      """
    `)
  })
})

describe('plain text copy block layout', () => {
  it('separates paragraphs with a blank line', () => {
    expect(copyText('show', 'aaa\n\nbbb')).toMatchInlineSnapshot(`
      """
      aaa

      bbb
      """
    `)
  })

  it('keeps gap paragraphs as extra blank lines', () => {
    expect(copyText('show', 'aaa\n\n\n\nbbb')).toMatchInlineSnapshot(`
      """
      aaa



      bbb
      """
    `)
  })

  it('keeps a soft break inside a paragraph', () => {
    expect(copyText('show', 'line1\nline2')).toMatchInlineSnapshot(`
      """
      line1
      line2
      """
    `)
  })

  it('drops a blockquote marker from a partial selection', () => {
    expect(
      copySelectionText('focus', (n) =>
        n.doc(n.blockquote(n.paragraph('f<a>irs<b>t'), n.paragraph('second'))),
      ),
    ).toBe('irs')
  })

  it('keeps a blockquote marker when all content is selected', () => {
    expect(
      copySelectionText('focus', (n) =>
        n.doc(n.blockquote(n.paragraph('<a>first'), n.paragraph('second<b>'))),
      ),
    ).toBe('> first\n>\n> second')
  })

  it('does not build a table around one fully selected cell', () => {
    expect(
      copySelectionText('focus', (n) =>
        n.doc(
          n.table(
            n.tableRow(
              n.tableHeaderCell(n.paragraph('<a>a<b>')),
              n.tableHeaderCell(n.paragraph('b')),
            ),
            n.tableRow(n.tableCell(n.paragraph('c')), n.tableCell(n.paragraph('d'))),
          ),
        ),
      ),
    ).toBe('a')
  })

  it('keeps a table when all cell content is selected', () => {
    expect(
      copySelectionText('focus', (n) =>
        n.doc(
          n.table(
            n.tableRow(n.tableHeaderCell(n.paragraph('<a>a')), n.tableHeaderCell(n.paragraph('b'))),
            n.tableRow(n.tableCell(n.paragraph('c')), n.tableCell(n.paragraph('d<b>'))),
          ),
        ),
      ),
    ).toBe('| a | b |\n| --- | --- |\n| c | d |')
  })

  it('keeps flat-list selection unwrapping', () => {
    expect(
      copySelectionText('focus', (n) =>
        n.doc(
          n.list({ kind: 'bullet' }, n.paragraph('<a>one<b>')),
          n.list({ kind: 'bullet' }, n.paragraph('two')),
        ),
      ),
    ).toBe('one')
  })
})

describe('native plain text copy', () => {
  it('writes a partial code block selection without fences', async () => {
    using fixture = setupFixture({ extensionOptions: { markMode: 'focus' } })
    const { n, view } = fixture
    fixture.set(n.doc(n.codeBlock({ language: 'typescript' }, 'const <a>value<b> = 1')))
    view.focus()

    await userEvent.copy()

    expect((await readClipboard()).text).toBe('value')
  })
})
