import { parseMarkdownAst } from '@meowdown/markdown'
import { commonmark } from 'commonmark.json'
import { expect, it } from 'vitest'

import { astToDoc } from './ast-to-pm.ts'
import { docToAst } from './pm-to-ast.ts'

// `checkRoundTrip` compares the editor's `docToMarkdown(markdownToDoc(md))` with
// the source; a caller that edits the AST directly serializes `parseMarkdownAst`
// output instead. Both paths agree only if building a document and reading it
// back changes nothing, so the parser must already produce what the schema
// forces (a list item never has zero blocks).
it.each(commonmark.map((example, index) => ({ number: index + 1, markdown: example.markdown })))(
  'spec example $number parses to the AST the editor reads back',
  ({ markdown }) => {
    const ast = parseMarkdownAst(markdown)
    expect(docToAst(astToDoc(ast))).toEqual(ast)
  },
)
