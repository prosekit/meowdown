import { createEditor } from '@prosekit/core'
import { describe, expect, it } from 'vitest'

import { defineEditorExtension } from './extension.ts'

describe('defineEditorExtension', () => {
  it('builds a document covering every node type', () => {
    const extension = defineEditorExtension()
    const editor = createEditor({ extension })
    const n = editor.nodes

    const doc = n.doc(
      n.heading({ level: 1 }, 'Title'),
      n.paragraph('A paragraph.'),
      n.blockquote(n.paragraph('A quote.')),
      n.list({ kind: 'bullet' }, n.paragraph('A bullet item.')),
      n.list({ kind: 'ordered', order: 1 }, n.paragraph('An ordered item.')),
      n.list({ kind: 'task', checked: false }, n.paragraph('A task item.')),
      n.codeBlock({ language: 'ts' }, 'const x = 1'),
      n.table(
        n.tableRow(n.tableHeaderCell(n.paragraph('H1')), n.tableHeaderCell(n.paragraph('H2'))),
        n.tableRow(n.tableCell(n.paragraph('A1')), n.tableCell(n.paragraph('B1'))),
      ),
      n.horizontalRule(),
      n.htmlComment({ content: '<!-- a comment -->' }),
    )

    expect(doc.toJSON()).toMatchInlineSnapshot(`
      {
        "attrs": {
          "frontmatter": null,
        },
        "content": [
          {
            "attrs": {
              "closingHashes": null,
              "level": 1,
              "setextUnderline": null,
            },
            "content": [
              {
                "text": "Title",
                "type": "text",
              },
            ],
            "type": "heading",
          },
          {
            "content": [
              {
                "text": "A paragraph.",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
          {
            "content": [
              {
                "content": [
                  {
                    "text": "A quote.",
                    "type": "text",
                  },
                ],
                "type": "paragraph",
              },
            ],
            "type": "blockquote",
          },
          {
            "attrs": {
              "checked": false,
              "collapsed": false,
              "kind": "bullet",
              "loose": false,
              "marker": null,
              "markerGap": 1,
              "order": null,
              "taskMarker": null,
            },
            "content": [
              {
                "content": [
                  {
                    "text": "A bullet item.",
                    "type": "text",
                  },
                ],
                "type": "paragraph",
              },
            ],
            "type": "list",
          },
          {
            "attrs": {
              "checked": false,
              "collapsed": false,
              "kind": "ordered",
              "loose": false,
              "marker": null,
              "markerGap": 1,
              "order": 1,
              "taskMarker": null,
            },
            "content": [
              {
                "content": [
                  {
                    "text": "An ordered item.",
                    "type": "text",
                  },
                ],
                "type": "paragraph",
              },
            ],
            "type": "list",
          },
          {
            "attrs": {
              "checked": false,
              "collapsed": false,
              "kind": "task",
              "loose": false,
              "marker": null,
              "markerGap": 1,
              "order": null,
              "taskMarker": null,
            },
            "content": [
              {
                "content": [
                  {
                    "text": "A task item.",
                    "type": "text",
                  },
                ],
                "type": "paragraph",
              },
            ],
            "type": "list",
          },
          {
            "attrs": {
              "language": "ts",
            },
            "content": [
              {
                "text": "const x = 1",
                "type": "text",
              },
            ],
            "type": "codeBlock",
          },
          {
            "content": [
              {
                "content": [
                  {
                    "attrs": {
                      "colspan": 1,
                      "colwidth": null,
                      "rowspan": 1,
                    },
                    "content": [
                      {
                        "content": [
                          {
                            "text": "H1",
                            "type": "text",
                          },
                        ],
                        "type": "paragraph",
                      },
                    ],
                    "type": "tableHeaderCell",
                  },
                  {
                    "attrs": {
                      "colspan": 1,
                      "colwidth": null,
                      "rowspan": 1,
                    },
                    "content": [
                      {
                        "content": [
                          {
                            "text": "H2",
                            "type": "text",
                          },
                        ],
                        "type": "paragraph",
                      },
                    ],
                    "type": "tableHeaderCell",
                  },
                ],
                "type": "tableRow",
              },
              {
                "content": [
                  {
                    "attrs": {
                      "colspan": 1,
                      "colwidth": null,
                      "rowspan": 1,
                    },
                    "content": [
                      {
                        "content": [
                          {
                            "text": "A1",
                            "type": "text",
                          },
                        ],
                        "type": "paragraph",
                      },
                    ],
                    "type": "tableCell",
                  },
                  {
                    "attrs": {
                      "colspan": 1,
                      "colwidth": null,
                      "rowspan": 1,
                    },
                    "content": [
                      {
                        "content": [
                          {
                            "text": "B1",
                            "type": "text",
                          },
                        ],
                        "type": "paragraph",
                      },
                    ],
                    "type": "tableCell",
                  },
                ],
                "type": "tableRow",
              },
            ],
            "type": "table",
          },
          {
            "attrs": {
              "marker": null,
            },
            "type": "horizontalRule",
          },
          {
            "attrs": {
              "content": "<!-- a comment -->",
            },
            "type": "htmlComment",
          },
        ],
        "type": "doc",
      }
    `)
  })
})
