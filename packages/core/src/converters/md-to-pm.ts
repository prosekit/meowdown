import { parseMarkdownAst } from '@meowdown/markdown'
import type { ProseMirrorNode, Schema } from '@prosekit/pm/model'

import type { TypedNodeBuilders } from '../extensions/schema.ts'

import { astToDoc } from './ast-to-pm.ts'

/**
 * Options for {@link markdownToDoc}.
 */
export interface MarkdownToDocOptions {
  /**
   * The schema to build the document with. Defaults to the shared schema.
   */
  schema?: Schema

  /**
   * Node builders whose schema builds the document. `schema` is the direct
   * spelling; this one remains for callers that hold an editor's `nodes`.
   */
  nodes?: TypedNodeBuilders

  /**
   * Whether to peel a leading `---` frontmatter block onto the doc's `frontmatter` attribute. Off by default.
   */
  frontmatter?: boolean
}

/**
 * Convert a markdown string into a ProseMirror document node.
 *
 * By default the document is built with the shared schema, so no editor is
 * required. When the result will be loaded into a specific editor, pass that
 * editor's `schema` so the document uses the editor's own schema instance and
 * can be inserted without a JSON round trip.
 *
 * The output follows the extension set defined in `../extensions/extension.ts`
 * (doc, paragraph, text, heading, blockquote, list, codeBlock, table, tableRow,
 * tableCell, tableHeaderCell, horizontalRule). The function does not produce
 * inline marks because the markdown stays literal text - emphasis / link /
 * inline-code characters survive verbatim.
 */
export function markdownToDoc(
  markdown: string,
  options: MarkdownToDocOptions = {},
): ProseMirrorNode {
  const schema = options.schema ?? (options.nodes ? options.nodes.doc().type.schema : undefined)
  return astToDoc(parseMarkdownAst(markdown, options), schema)
}
