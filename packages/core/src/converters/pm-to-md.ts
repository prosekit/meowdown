import { serializeMarkdownAst } from '@meowdown/markdown'
import type { ProseMirrorNode } from '@prosekit/pm/model'

import { docToAst } from './pm-to-ast.ts'

/**
 * Options for {@link docToMarkdown}.
 */
export interface DocToMarkdownOptions {
  /**
   * Whether to serialize the doc's `frontmatter` attribute as a leading `---` block. Off by default.
   */
  frontmatter?: boolean
}

/**
 * Convert persisted editor content to Markdown through the shared block serializer.
 */
export function docToMarkdown(node: ProseMirrorNode, options: DocToMarkdownOptions = {}): string {
  return serializeMarkdownAst(docToAst(node), options)
}
