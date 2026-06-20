import { defineNodeAttr, type Extension } from '@prosekit/core'

import type { NodeName } from './node-names.ts'

/**
 * The raw YAML frontmatter body, stored verbatim (the text between the opening
 * and closing `---` fences, without a trailing newline).
 *
 * - `null` means the document has no frontmatter (the default).
 * - `''` means an empty frontmatter block (`---\n---`).
 * - any other string is the body, which may contain newlines.
 */
export type Frontmatter = string | null

// `frontmatter` has a default, so it must stay optional in the node builders.
type DocFrontmatterExtension = Extension<{ Nodes: { doc: { frontmatter?: Frontmatter } } }>

/**
 * Stores YAML frontmatter as a non-rendered attribute on the root `doc` node.
 *
 * Frontmatter is document metadata, not content: it is never shown or edited
 * inline. The converters set it on parse (`markdownToDoc`) and read it on
 * serialize (`docToMarkdown`). There is no `toDOM` / `parseDOM`, because the
 * doc node is the editor root and ProseMirror's clipboard serialization never
 * includes the doc node itself, so there is nothing useful to persist to the
 * DOM.
 */
export function defineDocFrontmatterAttr(): DocFrontmatterExtension {
  return defineNodeAttr<'doc', 'frontmatter', Frontmatter>({
    type: 'doc' satisfies NodeName,
    attr: 'frontmatter',
    default: null,
  })
}
