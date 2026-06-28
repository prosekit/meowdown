import type { MarkdownParser } from '@lezer/markdown'
import { describe, expect, it } from 'vitest'

import { gfmBlockOnlyParser, gfmParser } from './parser.ts'

interface AstNode {
  name: string
  from: number
  to: number
  text: string
  children?: AstNode[]
}

function formatAstNode(node: AstNode, depth = 0): string {
  const indent = '  '.repeat(depth)
  const head = `${indent}${node.name} [${node.from}, ${node.to}] ${JSON.stringify(node.text)}`
  const children = (node.children ?? []).map((child) => formatAstNode(child, depth + 1))
  return [head, ...children].join('\n')
}

function parse(parser: MarkdownParser, text: string): string {
  const cursor = parser.parse(text).cursor()

  const build = (): AstNode => {
    const node: AstNode = {
      name: cursor.name,
      from: cursor.from,
      to: cursor.to,
      text: text.slice(cursor.from, cursor.to),
    }
    if (cursor.firstChild()) {
      do {
        const children = (node.children ??= [])
        children.push(build())
      } while (cursor.nextSibling())
      cursor.parent()
    }
    return node
  }

  return formatAstNode(build())
}

const sample = `
A *emph* paragraph.

| table header |
| ------------ |
| table cell   |

- bullet list item

- [x] task list item

paragraph line1
paragraph line2

> blockquote line1
> blockquote line2
`

describe('gfmParser', () => {
  it('parses block and inline structure', () => {
    expect(parse(gfmParser, sample)).toMatchInlineSnapshot(`
      "Document [0, 187] "\\nA *emph* paragraph.\\n\\n| table header |\\n| ------------ |\\n| table cell   |\\n\\n- bullet list item\\n\\n- [x] task list item\\n\\nparagraph line1\\nparagraph line2\\n\\n> blockquote line1\\n> blockquote line2\\n"
        Paragraph [1, 20] "A *emph* paragraph."
          Emphasis [3, 9] "*emph*"
            EmphasisMark [3, 4] "*"
            EmphasisMark [8, 9] "*"
        Table [22, 72] "| table header |\\n| ------------ |\\n| table cell   |"
          TableHeader [22, 38] "| table header |"
            TableDelimiter [22, 23] "|"
            TableCell [24, 36] "table header"
            TableDelimiter [37, 38] "|"
          TableDelimiter [39, 55] "| ------------ |"
          TableRow [56, 72] "| table cell   |"
            TableDelimiter [56, 57] "|"
            TableCell [58, 68] "table cell"
            TableDelimiter [71, 72] "|"
        BulletList [74, 114] "- bullet list item\\n\\n- [x] task list item"
          ListItem [74, 92] "- bullet list item"
            ListMark [74, 75] "-"
            Paragraph [76, 92] "bullet list item"
          ListItem [94, 114] "- [x] task list item"
            ListMark [94, 95] "-"
            Task [96, 114] "[x] task list item"
              TaskMarker [96, 99] "[x]"
        Paragraph [116, 147] "paragraph line1\\nparagraph line2"
        Blockquote [149, 186] "> blockquote line1\\n> blockquote line2"
          QuoteMark [149, 150] ">"
          Paragraph [151, 186] "blockquote line1\\n> blockquote line2"
            QuoteMark [168, 169] ">""
    `)
  })
})

describe('gfmBlockOnlyParser', () => {
  it('parses block structure but never emits inline nodes', () => {
    expect(parse(gfmBlockOnlyParser, sample)).toMatchInlineSnapshot(`
      "Document [0, 187] "\\nA *emph* paragraph.\\n\\n| table header |\\n| ------------ |\\n| table cell   |\\n\\n- bullet list item\\n\\n- [x] task list item\\n\\nparagraph line1\\nparagraph line2\\n\\n> blockquote line1\\n> blockquote line2\\n"
        Paragraph [1, 20] "A *emph* paragraph."
        Table [22, 72] "| table header |\\n| ------------ |\\n| table cell   |"
          TableHeader [22, 38] "| table header |"
            TableDelimiter [22, 23] "|"
            TableCell [24, 36] "table header"
            TableDelimiter [37, 38] "|"
          TableDelimiter [39, 55] "| ------------ |"
          TableRow [56, 72] "| table cell   |"
            TableDelimiter [56, 57] "|"
            TableCell [58, 68] "table cell"
            TableDelimiter [71, 72] "|"
        BulletList [74, 114] "- bullet list item\\n\\n- [x] task list item"
          ListItem [74, 92] "- bullet list item"
            ListMark [74, 75] "-"
            Paragraph [76, 92] "bullet list item"
          ListItem [94, 114] "- [x] task list item"
            ListMark [94, 95] "-"
            Task [96, 114] "[x] task list item"
              TaskMarker [96, 99] "[x]"
        Paragraph [116, 147] "paragraph line1\\nparagraph line2"
        Blockquote [149, 186] "> blockquote line1\\n> blockquote line2"
          QuoteMark [149, 150] ">"
          Paragraph [151, 186] "blockquote line1\\n> blockquote line2"
            QuoteMark [168, 169] ">""
    `)
  })

  it('keeps a list item continuation indent inside the paragraph span', () => {
    // A soft-wrapped paragraph inside a list item. lezer's Paragraph starts
    // after the first line's indent, but the continuation line's 2-space indent
    // stays inside the node's [from, to) span (see the `\n  line two` in `text`).
    const input = '- x\n\n  line one\n  line two\n'
    expect(parse(gfmBlockOnlyParser, input)).toMatchInlineSnapshot(`
      "Document [0, 27] "- x\\n\\n  line one\\n  line two\\n"
        BulletList [0, 26] "- x\\n\\n  line one\\n  line two"
          ListItem [0, 26] "- x\\n\\n  line one\\n  line two"
            ListMark [0, 1] "-"
            Paragraph [2, 3] "x"
            Paragraph [7, 26] "line one\\n  line two""
    `)
  })

  it('emits one CodeText per line for a fenced code block inside a list item', () => {
    // A multi-line fenced code block inside a list item. Unlike a top-level
    // block (one CodeText spanning every line), lezer scrubs each line's 2-space
    // container indent and emits one CodeText per line, the stripped indent
    // living in the gaps between the nodes. Each CodeText slice already carries
    // its own trailing newline, so concatenating them rebuilds the code text.
    const input = [
      // A code block inside a list item
      '- x',
      '',
      '  ```',
      '  line1',
      '  line2',
      '  line3',
      '  ```',
    ].join('\n')
    expect(parse(gfmBlockOnlyParser, input)).toMatchInlineSnapshot(`
      "Document [0, 40] "- x\\n\\n  \`\`\`\\n  line1\\n  line2\\n  line3\\n  \`\`\`"
        BulletList [0, 40] "- x\\n\\n  \`\`\`\\n  line1\\n  line2\\n  line3\\n  \`\`\`"
          ListItem [0, 40] "- x\\n\\n  \`\`\`\\n  line1\\n  line2\\n  line3\\n  \`\`\`"
            ListMark [0, 1] "-"
            Paragraph [2, 3] "x"
            FencedCode [7, 40] "\`\`\`\\n  line1\\n  line2\\n  line3\\n  \`\`\`"
              CodeMark [7, 10] "\`\`\`"
              CodeText [13, 19] "line1\\n"
              CodeText [21, 27] "line2\\n"
              CodeText [29, 34] "line3"
              CodeMark [37, 40] "\`\`\`""
    `)
  })

  it('tokenizes the opening and closing marks of an ATX heading', () => {
    expect(parse(gfmBlockOnlyParser, '# title')).toMatchInlineSnapshot(`
      "Document [0, 7] "# title"
        ATXHeading1 [0, 7] "# title"
          HeaderMark [0, 1] "#""
    `)
    expect(parse(gfmBlockOnlyParser, '##  title')).toMatchInlineSnapshot(`
      "Document [0, 9] "##  title"
        ATXHeading2 [0, 9] "##  title"
          HeaderMark [0, 2] "##""
    `)
    expect(parse(gfmBlockOnlyParser, '# title #')).toMatchInlineSnapshot(`
      "Document [0, 9] "# title #"
        ATXHeading1 [0, 9] "# title #"
          HeaderMark [0, 1] "#"
          HeaderMark [8, 9] "#""
    `)
    expect(parse(gfmBlockOnlyParser, '## title #######')).toMatchInlineSnapshot(`
      "Document [0, 16] "## title #######"
        ATXHeading2 [0, 16] "## title #######"
          HeaderMark [0, 2] "##"
          HeaderMark [9, 16] "#######""
    `)
  })
})
