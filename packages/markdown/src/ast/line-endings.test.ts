import { describe, expect, it } from 'vitest'

import { parseMarkdownAst, serializeMarkdownAst } from '../index.ts'

const source =
  '---\nname: test\n---\n\n+ [ ] 😀 **first**\n  *second*\n\n  > quote\n\n  ~~~js\n  code\n  ~~~\n\n  | a | b |\n  | :--- | ---: |\n  | c | d |\n'

describe('AST line endings', () => {
  it('parses CRLF tasks, tables, and frontmatter like LF', () => {
    const document = parseMarkdownAst(source.replaceAll('\n', '\r\n'), { frontmatter: true })
    expect(document).toEqual(parseMarkdownAst(source, { frontmatter: true }))
    const output = serializeMarkdownAst(document, { frontmatter: true })
    expect(output).toContain('😀 **first**\n  *second*')
    expect(output).toContain('| :-- | --: |')
    expect(output).not.toContain('\r')
  })

  it('parses bare carriage returns like LF', () => {
    expect(parseMarkdownAst(source.replaceAll('\n', '\r'), { frontmatter: true })).toEqual(
      parseMarkdownAst(source, { frontmatter: true }),
    )
  })

  it('normalizes mixed line endings inside nested task paragraphs', () => {
    expect(parseMarkdownAst('>\t+ [ ] first\r\n>\t  second\rthird\n')).toEqual(
      parseMarkdownAst('>\t+ [ ] first\n>\t  second\nthird\n'),
    )
  })
})
