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
    text: text.slice(cursor.from, cursor.to)
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
        "to": 115,
        "text": "\\nA *emph* paragraph.\\n\\n| table header |\\n| ------------ |\\n| table cell   |\\n\\n- bullet list item\\n\\n- [x] task list item\\n",
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
          }
        ]
      }"
    `)
  })
})

describe('gfmBlockOnlyParser', () => {
  it('parses block structure but never emits inline nodes', () => {
    expect(show(buildAst(gfmBlockOnlyParser.parse(sample).cursor(), sample))).toMatchInlineSnapshot(`
      "{
        "name": "Document",
        "from": 0,
        "to": 115,
        "text": "\\nA *emph* paragraph.\\n\\n| table header |\\n| ------------ |\\n| table cell   |\\n\\n- bullet list item\\n\\n- [x] task list item\\n",
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
          }
        ]
      }"
    `)
  })
})
