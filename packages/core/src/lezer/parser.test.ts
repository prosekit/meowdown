import type { TreeCursor } from '@lezer/common'
import { describe, expect, it } from 'vitest'

import { gfmBlockOnlyParser, gfmParser } from './parser.ts'

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

interface AstNode {
  name: string
  from: number
  to: number
  text: string
  children?: AstNode[]
}

function buildAst(cursor: TreeCursor, text: string): AstNode {
  const node: AstNode = {
    name: cursor.name,
    from: cursor.from,
    to: cursor.to,
    text: text.slice(cursor.from, cursor.to),
  }
  if (cursor.firstChild()) {
    do {
      const children = (node.children ??= [])
      children.push(buildAst(cursor, text))
    } while (cursor.nextSibling())
    cursor.parent()
  }
  return node
}

const show = (ast: AstNode) => JSON.stringify(ast, null, 2)

describe('gfmParser', () => {
  it('parses block and inline structure', () => {
    expect(show(buildAst(gfmParser.parse(sample).cursor(), sample))).toMatchInlineSnapshot(`
      "{
        "name": "Document",
        "from": 0,
        "to": 187,
        "text": "\\nA *emph* paragraph.\\n\\n| table header |\\n| ------------ |\\n| table cell   |\\n\\n- bullet list item\\n\\n- [x] task list item\\n\\nparagraph line1\\nparagraph line2\\n\\n> blockquote line1\\n> blockquote line2\\n",
        "children": [
          {
            "name": "Paragraph",
            "from": 1,
            "to": 20,
            "text": "A *emph* paragraph.",
            "children": [
              {
                "name": "Emphasis",
                "from": 3,
                "to": 9,
                "text": "*emph*",
                "children": [
                  {
                    "name": "EmphasisMark",
                    "from": 3,
                    "to": 4,
                    "text": "*"
                  },
                  {
                    "name": "EmphasisMark",
                    "from": 8,
                    "to": 9,
                    "text": "*"
                  }
                ]
              }
            ]
          },
          {
            "name": "Table",
            "from": 22,
            "to": 72,
            "text": "| table header |\\n| ------------ |\\n| table cell   |",
            "children": [
              {
                "name": "TableHeader",
                "from": 22,
                "to": 38,
                "text": "| table header |",
                "children": [
                  {
                    "name": "TableDelimiter",
                    "from": 22,
                    "to": 23,
                    "text": "|"
                  },
                  {
                    "name": "TableCell",
                    "from": 24,
                    "to": 36,
                    "text": "table header"
                  },
                  {
                    "name": "TableDelimiter",
                    "from": 37,
                    "to": 38,
                    "text": "|"
                  }
                ]
              },
              {
                "name": "TableDelimiter",
                "from": 39,
                "to": 55,
                "text": "| ------------ |"
              },
              {
                "name": "TableRow",
                "from": 56,
                "to": 72,
                "text": "| table cell   |",
                "children": [
                  {
                    "name": "TableDelimiter",
                    "from": 56,
                    "to": 57,
                    "text": "|"
                  },
                  {
                    "name": "TableCell",
                    "from": 58,
                    "to": 68,
                    "text": "table cell"
                  },
                  {
                    "name": "TableDelimiter",
                    "from": 71,
                    "to": 72,
                    "text": "|"
                  }
                ]
              }
            ]
          },
          {
            "name": "BulletList",
            "from": 74,
            "to": 114,
            "text": "- bullet list item\\n\\n- [x] task list item",
            "children": [
              {
                "name": "ListItem",
                "from": 74,
                "to": 92,
                "text": "- bullet list item",
                "children": [
                  {
                    "name": "ListMark",
                    "from": 74,
                    "to": 75,
                    "text": "-"
                  },
                  {
                    "name": "Paragraph",
                    "from": 76,
                    "to": 92,
                    "text": "bullet list item"
                  }
                ]
              },
              {
                "name": "ListItem",
                "from": 94,
                "to": 114,
                "text": "- [x] task list item",
                "children": [
                  {
                    "name": "ListMark",
                    "from": 94,
                    "to": 95,
                    "text": "-"
                  },
                  {
                    "name": "Task",
                    "from": 96,
                    "to": 114,
                    "text": "[x] task list item",
                    "children": [
                      {
                        "name": "TaskMarker",
                        "from": 96,
                        "to": 99,
                        "text": "[x]"
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            "name": "Paragraph",
            "from": 116,
            "to": 147,
            "text": "paragraph line1\\nparagraph line2"
          },
          {
            "name": "Blockquote",
            "from": 149,
            "to": 186,
            "text": "> blockquote line1\\n> blockquote line2",
            "children": [
              {
                "name": "QuoteMark",
                "from": 149,
                "to": 150,
                "text": ">"
              },
              {
                "name": "Paragraph",
                "from": 151,
                "to": 186,
                "text": "blockquote line1\\n> blockquote line2",
                "children": [
                  {
                    "name": "QuoteMark",
                    "from": 168,
                    "to": 169,
                    "text": ">"
                  }
                ]
              }
            ]
          }
        ]
      }"
    `)
  })
})

describe('gfmBlockOnlyParser', () => {
  it('parses block structure but never emits inline nodes', () => {
    expect(show(buildAst(gfmBlockOnlyParser.parse(sample).cursor(), sample)))
      .toMatchInlineSnapshot(`
      "{
        "name": "Document",
        "from": 0,
        "to": 187,
        "text": "\\nA *emph* paragraph.\\n\\n| table header |\\n| ------------ |\\n| table cell   |\\n\\n- bullet list item\\n\\n- [x] task list item\\n\\nparagraph line1\\nparagraph line2\\n\\n> blockquote line1\\n> blockquote line2\\n",
        "children": [
          {
            "name": "Paragraph",
            "from": 1,
            "to": 20,
            "text": "A *emph* paragraph."
          },
          {
            "name": "Table",
            "from": 22,
            "to": 72,
            "text": "| table header |\\n| ------------ |\\n| table cell   |",
            "children": [
              {
                "name": "TableHeader",
                "from": 22,
                "to": 38,
                "text": "| table header |",
                "children": [
                  {
                    "name": "TableDelimiter",
                    "from": 22,
                    "to": 23,
                    "text": "|"
                  },
                  {
                    "name": "TableCell",
                    "from": 24,
                    "to": 36,
                    "text": "table header"
                  },
                  {
                    "name": "TableDelimiter",
                    "from": 37,
                    "to": 38,
                    "text": "|"
                  }
                ]
              },
              {
                "name": "TableDelimiter",
                "from": 39,
                "to": 55,
                "text": "| ------------ |"
              },
              {
                "name": "TableRow",
                "from": 56,
                "to": 72,
                "text": "| table cell   |",
                "children": [
                  {
                    "name": "TableDelimiter",
                    "from": 56,
                    "to": 57,
                    "text": "|"
                  },
                  {
                    "name": "TableCell",
                    "from": 58,
                    "to": 68,
                    "text": "table cell"
                  },
                  {
                    "name": "TableDelimiter",
                    "from": 71,
                    "to": 72,
                    "text": "|"
                  }
                ]
              }
            ]
          },
          {
            "name": "BulletList",
            "from": 74,
            "to": 114,
            "text": "- bullet list item\\n\\n- [x] task list item",
            "children": [
              {
                "name": "ListItem",
                "from": 74,
                "to": 92,
                "text": "- bullet list item",
                "children": [
                  {
                    "name": "ListMark",
                    "from": 74,
                    "to": 75,
                    "text": "-"
                  },
                  {
                    "name": "Paragraph",
                    "from": 76,
                    "to": 92,
                    "text": "bullet list item"
                  }
                ]
              },
              {
                "name": "ListItem",
                "from": 94,
                "to": 114,
                "text": "- [x] task list item",
                "children": [
                  {
                    "name": "ListMark",
                    "from": 94,
                    "to": 95,
                    "text": "-"
                  },
                  {
                    "name": "Task",
                    "from": 96,
                    "to": 114,
                    "text": "[x] task list item",
                    "children": [
                      {
                        "name": "TaskMarker",
                        "from": 96,
                        "to": 99,
                        "text": "[x]"
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            "name": "Paragraph",
            "from": 116,
            "to": 147,
            "text": "paragraph line1\\nparagraph line2"
          },
          {
            "name": "Blockquote",
            "from": 149,
            "to": 186,
            "text": "> blockquote line1\\n> blockquote line2",
            "children": [
              {
                "name": "QuoteMark",
                "from": 149,
                "to": 150,
                "text": ">"
              },
              {
                "name": "Paragraph",
                "from": 151,
                "to": 186,
                "text": "blockquote line1\\n> blockquote line2",
                "children": [
                  {
                    "name": "QuoteMark",
                    "from": 168,
                    "to": 169,
                    "text": ">"
                  }
                ]
              }
            ]
          }
        ]
      }"
    `)
  })

  it('keeps a list item continuation indent inside the paragraph span', () => {
    // A soft-wrapped paragraph inside a list item. lezer's Paragraph starts
    // after the first line's indent, but the continuation line's 2-space indent
    // stays inside the node's [from, to) span (see the `\n  line two` in `text`).
    const input = '- x\n\n  line one\n  line two\n'
    expect(show(buildAst(gfmBlockOnlyParser.parse(input).cursor(), input))).toMatchInlineSnapshot(`
      "{
        "name": "Document",
        "from": 0,
        "to": 27,
        "text": "- x\\n\\n  line one\\n  line two\\n",
        "children": [
          {
            "name": "BulletList",
            "from": 0,
            "to": 26,
            "text": "- x\\n\\n  line one\\n  line two",
            "children": [
              {
                "name": "ListItem",
                "from": 0,
                "to": 26,
                "text": "- x\\n\\n  line one\\n  line two",
                "children": [
                  {
                    "name": "ListMark",
                    "from": 0,
                    "to": 1,
                    "text": "-"
                  },
                  {
                    "name": "Paragraph",
                    "from": 2,
                    "to": 3,
                    "text": "x"
                  },
                  {
                    "name": "Paragraph",
                    "from": 7,
                    "to": 26,
                    "text": "line one\\n  line two"
                  }
                ]
              }
            ]
          }
        ]
      }"
    `)
  })
})
