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

function parse(text: string) {
  return parseInline(text)
    .map((element) => formatInlineElement(element, text))
    .join('\n')
}

describe('emphasis', () => {
  it('can parses emphasis', () => {
    const text = '*foo* bar **baz**'
    expect(parse(text)).toMatchInlineSnapshot(`
      "Emphasis [0, 5] "*foo*"
        EmphasisMark [0, 1] "*"
        EmphasisMark [4, 5] "*"
      StrongEmphasis [10, 17] "**baz**"
        EmphasisMark [10, 12] "**"
        EmphasisMark [15, 17] "**""
    `)
  })
})

describe('image', () => {
  it('can parse image', () => {
    expect(parse('![alt](url)')).toMatchInlineSnapshot(`
      "Image [0, 11] "![alt](url)"
        LinkMark [0, 2] "!["
        LinkMark [5, 6] "]"
        LinkMark [6, 7] "("
        URL [7, 10] "url"
        LinkMark [10, 11] ")""
    `)
  })

  it('can parse image with inline HTML comment', () => {
    expect(parse('![alt](url)<!-- {"width":100} -->')).toMatchInlineSnapshot(`
      "Image [0, 11] "![alt](url)"
        LinkMark [0, 2] "!["
        LinkMark [5, 6] "]"
        LinkMark [6, 7] "("
        URL [7, 10] "url"
        LinkMark [10, 11] ")"
      Comment [11, 33] "<!-- {\\"width\\":100} -->""
    `)
  })
})

describe('highlight', () => {
  it('wraps the run in Highlight with HighlightMark delimiters', () => {
    expect(parse('==hi==')).toMatchInlineSnapshot(`
      "Highlight [0, 6] "==hi=="
        HighlightMark [0, 2] "=="
        HighlightMark [4, 6] "==""
    `)
  })

  it('finds a highlight surrounded by text', () => {
    expect(parse('a ==hi== b')).toMatchInlineSnapshot(`
      "Highlight [2, 8] "==hi=="
        HighlightMark [2, 4] "=="
        HighlightMark [6, 8] "==""
    `)
  })

  it('allows nested inline syntax inside a highlight', () => {
    expect(parse('==**bold**==')).toMatchInlineSnapshot(`
      "Highlight [0, 12] "==**bold**=="
        HighlightMark [0, 2] "=="
        StrongEmphasis [2, 10] "**bold**"
          EmphasisMark [2, 4] "**"
          EmphasisMark [8, 10] "**"
        HighlightMark [10, 12] "==""
    `)
  })

  it('nests with strikethrough both ways', () => {
    expect(parse('~~==hi==~~')).toMatchInlineSnapshot(`
      "Strikethrough [0, 10] "~~==hi==~~"
        StrikethroughMark [0, 2] "~~"
        Highlight [2, 8] "==hi=="
          HighlightMark [2, 4] "=="
          HighlightMark [6, 8] "=="
        StrikethroughMark [8, 10] "~~""
    `)
    expect(parse('==~~hi~~==')).toMatchInlineSnapshot(`
      "Highlight [0, 10] "==~~hi~~=="
        HighlightMark [0, 2] "=="
        Strikethrough [2, 8] "~~hi~~"
          StrikethroughMark [2, 4] "~~"
          StrikethroughMark [6, 8] "~~"
        HighlightMark [8, 10] "==""
    `)
  })

  it('does not highlight space-flanked equals runs', () => {
    expect(parse('a == b == c')).toMatchInlineSnapshot(`""`)
    expect(parse('== x ==')).toMatchInlineSnapshot(`""`)
  })

  it('does not consume a third equals as a delimiter', () => {
    expect(parse('foo === bar')).toMatchInlineSnapshot(`""`)
  })
})
