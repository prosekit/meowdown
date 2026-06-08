import { describe, expect, it } from 'vitest'

import { type InlineElement, parseInline } from './inline.ts'
import { LEZER_NODE_IDS } from './node-ids.ts'

const NODE_NAME_BY_ID = new Map(Object.entries(LEZER_NODE_IDS).map(([name, id]) => [id, name]))

/**
 * Render an inline element tree into an indented, human-readable string.
 */
function formatInlineElement(element: InlineElement, text: string, depth = 0): string {
  const indent = '  '.repeat(depth)
  const name = NODE_NAME_BY_ID.get(element.type) ?? `#${element.type}`
  const slice = JSON.stringify(text.slice(element.from, element.to))
  const head = `${indent}${name} [${element.from}, ${element.to}] ${slice}`
  const children = element.children.map((child) => formatInlineElement(child, text, depth + 1))
  return [head, ...children].join('\n')
}

describe('parseInline', () => {
  it('parses emphasis into an inline element tree', () => {
    const text = '*foo* bar **baz**'
    const formatted = parseInline(text)
      .map((element) => formatInlineElement(element, text))
      .join('\n')

    expect(formatted).toMatchInlineSnapshot(`
      "Emphasis [0, 5] "*foo*"
        EmphasisMark [0, 1] "*"
        EmphasisMark [4, 5] "*"
      StrongEmphasis [10, 17] "**baz**"
        EmphasisMark [10, 12] "**"
        EmphasisMark [15, 17] "**""
    `)
  })
})
