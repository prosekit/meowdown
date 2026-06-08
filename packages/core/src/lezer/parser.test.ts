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
  children?: AstNode[]
}

function buildAst(cursor: TreeCursor): AstNode {
  const node: AstNode = { name: cursor.name, from: cursor.from, to: cursor.to }
  if (cursor.firstChild()) {
    do {
      const children = (node.children ??= [])
      children.push(buildAst(cursor))
    } while (cursor.nextSibling())
    cursor.parent()
  }
  return node
}

const show = (ast: AstNode) => JSON.stringify(ast, null, 2)

describe('gfmParser', () => {
  it('parses block and inline structure', () => {
    expect(show(buildAst(gfmParser.parse(sample).cursor()))).toMatchInlineSnapshot(`
      "{
        "name": "Document",
        "from": 0,
        "to": 115,
        "children": [
          {
            "name": "Paragraph",
            "from": 1,
            "to": 20,
            "children": [
              {
                "name": "Emphasis",
                "from": 3,
                "to": 9,
                "children": [
                  {
                    "name": "EmphasisMark",
                    "from": 3,
                    "to": 4
                  },
                  {
                    "name": "EmphasisMark",
                    "from": 8,
                    "to": 9
                  }
                ]
              }
            ]
          },
          {
            "name": "Table",
            "from": 22,
            "to": 72,
            "children": [
              {
                "name": "TableHeader",
                "from": 22,
                "to": 38,
                "children": [
                  {
                    "name": "TableDelimiter",
                    "from": 22,
                    "to": 23
                  },
                  {
                    "name": "TableCell",
                    "from": 24,
                    "to": 36
                  },
                  {
                    "name": "TableDelimiter",
                    "from": 37,
                    "to": 38
                  }
                ]
              },
              {
                "name": "TableDelimiter",
                "from": 39,
                "to": 55
              },
              {
                "name": "TableRow",
                "from": 56,
                "to": 72,
                "children": [
                  {
                    "name": "TableDelimiter",
                    "from": 56,
                    "to": 57
                  },
                  {
                    "name": "TableCell",
                    "from": 58,
                    "to": 68
                  },
                  {
                    "name": "TableDelimiter",
                    "from": 71,
                    "to": 72
                  }
                ]
              }
            ]
          },
          {
            "name": "BulletList",
            "from": 74,
            "to": 114,
            "children": [
              {
                "name": "ListItem",
                "from": 74,
                "to": 92,
                "children": [
                  {
                    "name": "ListMark",
                    "from": 74,
                    "to": 75
                  },
                  {
                    "name": "Paragraph",
                    "from": 76,
                    "to": 92
                  }
                ]
              },
              {
                "name": "ListItem",
                "from": 94,
                "to": 114,
                "children": [
                  {
                    "name": "ListMark",
                    "from": 94,
                    "to": 95
                  },
                  {
                    "name": "Task",
                    "from": 96,
                    "to": 114,
                    "children": [
                      {
                        "name": "TaskMarker",
                        "from": 96,
                        "to": 99
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
    expect(show(buildAst(gfmBlockOnlyParser.parse(sample).cursor()))).toMatchInlineSnapshot(`
      "{
        "name": "Document",
        "from": 0,
        "to": 115,
        "children": [
          {
            "name": "Paragraph",
            "from": 1,
            "to": 20
          },
          {
            "name": "Table",
            "from": 22,
            "to": 72,
            "children": [
              {
                "name": "TableHeader",
                "from": 22,
                "to": 38,
                "children": [
                  {
                    "name": "TableDelimiter",
                    "from": 22,
                    "to": 23
                  },
                  {
                    "name": "TableCell",
                    "from": 24,
                    "to": 36
                  },
                  {
                    "name": "TableDelimiter",
                    "from": 37,
                    "to": 38
                  }
                ]
              },
              {
                "name": "TableDelimiter",
                "from": 39,
                "to": 55
              },
              {
                "name": "TableRow",
                "from": 56,
                "to": 72,
                "children": [
                  {
                    "name": "TableDelimiter",
                    "from": 56,
                    "to": 57
                  },
                  {
                    "name": "TableCell",
                    "from": 58,
                    "to": 68
                  },
                  {
                    "name": "TableDelimiter",
                    "from": 71,
                    "to": 72
                  }
                ]
              }
            ]
          },
          {
            "name": "BulletList",
            "from": 74,
            "to": 114,
            "children": [
              {
                "name": "ListItem",
                "from": 74,
                "to": 92,
                "children": [
                  {
                    "name": "ListMark",
                    "from": 74,
                    "to": 75
                  },
                  {
                    "name": "Paragraph",
                    "from": 76,
                    "to": 92
                  }
                ]
              },
              {
                "name": "ListItem",
                "from": 94,
                "to": 114,
                "children": [
                  {
                    "name": "ListMark",
                    "from": 94,
                    "to": 95
                  },
                  {
                    "name": "Task",
                    "from": 96,
                    "to": 114,
                    "children": [
                      {
                        "name": "TaskMarker",
                        "from": 96,
                        "to": 99
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
