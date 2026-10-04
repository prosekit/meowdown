import { describe, expect, it } from 'vitest'

import { isMarkdownAstEqual } from './equal.ts'
import { parseMarkdownAst } from './parse.ts'
import { serializeMarkdownAst } from './serialize.ts'
import type { MarkdownDocument } from './types.ts'

const SOURCE =
  '---\nk: v\n---\n\n# Title\n\n+   [X] **buy**\n\n    > quote\n\n3) ordered\n\n~~~js\ncode\n~~~\n\n***\n\n<!-- hidden -->\n\n| a | b |\n| :-- | --: |\n| c | d |\n'

describe('isMarkdownAstEqual', () => {
  it('equals a second parse of the same source', () => {
    const options = { frontmatter: true }
    expect(
      isMarkdownAstEqual(parseMarkdownAst(SOURCE, options), parseMarkdownAst(SOURCE, options)),
    ).toBe(true)
  })

  it('ignores the order in which fields were set', () => {
    expect(
      isMarkdownAstEqual(
        { type: 'document', children: [{ type: 'heading', level: 2, value: 'a' }] },
        { children: [{ value: 'a', level: 2, type: 'heading' }], type: 'document' },
      ),
    ).toBe(true)
  })

  it('reads an absent optional field as undefined', () => {
    expect(
      isMarkdownAstEqual(
        { type: 'document', children: [{ type: 'horizontalRule' }] },
        {
          type: 'document',
          frontmatter: undefined,
          children: [{ type: 'horizontalRule', marker: undefined }],
        },
      ),
    ).toBe(true)
  })

  it('ignores positions', () => {
    const parsed = parseMarkdownAst('- a\n  - b\n')
    expect(isMarkdownAstEqual(parsed, parseMarkdownAst('- a\n    - b\n'))).toBe(true)
    const built: MarkdownDocument = {
      type: 'document',
      children: [{ type: 'paragraph', value: 'a' }],
    }
    expect(isMarkdownAstEqual(parseMarkdownAst('a\n'), built)).toBe(true)
  })

  it('finds a changed field', () => {
    const document = parseMarkdownAst('+ [ ] a\n')
    expect(isMarkdownAstEqual(document, parseMarkdownAst('+ [x] a\n'))).toBe(false)
    expect(isMarkdownAstEqual(document, parseMarkdownAst('+ [ ] b\n'))).toBe(false)
    expect(isMarkdownAstEqual(document, parseMarkdownAst('- [ ] a\n'))).toBe(false)
  })

  it('finds a changed node type', () => {
    expect(isMarkdownAstEqual(parseMarkdownAst('a\n'), parseMarkdownAst('# a\n'))).toBe(false)
  })

  it('finds an added or removed child at any depth', () => {
    const document = parseMarkdownAst('> - a\n')
    expect(isMarkdownAstEqual(document, parseMarkdownAst('> - a\n> - b\n'))).toBe(false)
    expect(isMarkdownAstEqual(document, parseMarkdownAst('> - a\n>   - b\n'))).toBe(false)
  })

  it('finds a changed frontmatter', () => {
    const options = { frontmatter: true }
    expect(
      isMarkdownAstEqual(
        parseMarkdownAst('---\na: 1\n---\n', options),
        parseMarkdownAst('---\na: 2\n---\n', options),
      ),
    ).toBe(false)
  })

  it('equals the tree read back from its own serialized form', () => {
    const options = { frontmatter: true }
    const document = parseMarkdownAst(SOURCE, options)
    const reparsed = parseMarkdownAst(serializeMarkdownAst(document, options), options)
    expect(isMarkdownAstEqual(document, reparsed)).toBe(true)
  })
})
