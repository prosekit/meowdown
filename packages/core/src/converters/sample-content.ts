import type { NodeJSON } from '@prosekit/core'

export const sampleContent: NodeJSON = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Meowdown' }],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'A minimal markdown editor playground. Try editing this content.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'This paragraph has *italic*, **bold**, ~~strikethrough~~, and `inline code`. Also a [link to Lezer](https://lezer.codemirror.net).',
        },
      ],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Headings' }],
    },
    {
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'This is an H3' }],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Blockquote' }],
    },
    {
      type: 'blockquote',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'In markdown, a line starting with > becomes a blockquote.',
            },
          ],
        },
      ],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Bullet list' }],
    },
    {
      type: 'list',
      attrs: { kind: 'bullet', order: null, checked: false, collapsed: false },
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'First item' }],
        },
      ],
    },
    {
      type: 'list',
      attrs: { kind: 'bullet', order: null, checked: false, collapsed: false },
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Second item' }],
        },
        {
          type: 'list',
          attrs: {
            kind: 'bullet',
            order: null,
            checked: false,
            collapsed: false,
          },
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'A nested bullet' }],
            },
          ],
        },
      ],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Ordered list' }],
    },
    {
      type: 'list',
      attrs: { kind: 'ordered', order: 1, checked: false, collapsed: false },
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Step one' }],
        },
      ],
    },
    {
      type: 'list',
      attrs: { kind: 'ordered', order: 2, checked: false, collapsed: false },
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Step two' }],
        },
      ],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Code block' }],
    },
    {
      type: 'codeBlock',
      attrs: { language: 'ts' },
      content: [
        {
          type: 'text',
          text: 'function hello(name: string) {\n  console.log(`Hello, ${name}!`)\n}',
        },
      ],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Table' }],
    },
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableHeaderCell',
              attrs: { colspan: 1, rowspan: 1, colwidth: null },
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Syntax' }],
                },
              ],
            },
            {
              type: 'tableHeaderCell',
              attrs: { colspan: 1, rowspan: 1, colwidth: null },
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Description' }],
                },
              ],
            },
          ],
        },
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              attrs: { colspan: 1, rowspan: 1, colwidth: null },
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: '# Heading' }],
                },
              ],
            },
            {
              type: 'tableCell',
              attrs: { colspan: 1, rowspan: 1, colwidth: null },
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Creates a heading' }],
                },
              ],
            },
          ],
        },
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              attrs: { colspan: 1, rowspan: 1, colwidth: null },
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: '- item' }],
                },
              ],
            },
            {
              type: 'tableCell',
              attrs: { colspan: 1, rowspan: 1, colwidth: null },
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Creates a bullet list' }],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'horizontalRule',
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Above is a horizontal rule. Happy editing!',
        },
      ],
    },
  ],
}

export const sampleContentMarkdown = `# Meowdown

A minimal markdown editor playground. Try editing this content.

This paragraph has *italic*, **bold**, ~~strikethrough~~, and \`inline code\`. Also a [link to Lezer](https://lezer.codemirror.net).

## Headings

### This is an H3

## Blockquote

> In markdown, a line starting with > becomes a blockquote.

## Bullet list

- First item
- Second item
  - A nested bullet

## Ordered list

1. Step one
2. Step two

## Code block

\`\`\`ts
function hello(name: string) {
  console.log(\`Hello, \${name}!\`)
}
\`\`\`

## Table

| Syntax    | Description           |
| --------- | --------------------- |
| # Heading | Creates a heading     |
| - item    | Creates a bullet list |

---

Above is a horizontal rule. Happy editing!
`
