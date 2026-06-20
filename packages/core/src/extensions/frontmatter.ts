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

type DocFrontmatterExtension = Extension<{ Nodes: { doc: { frontmatter?: Frontmatter } } }>

/**
 * Stores YAML frontmatter as a non-rendered attribute on the root `doc` node.
 */
export function defineDocFrontmatterAttr(): DocFrontmatterExtension {
  return defineNodeAttr<'doc', 'frontmatter', Frontmatter>({
    type: 'doc' satisfies NodeName,
    attr: 'frontmatter',
    default: null,
  })
}
