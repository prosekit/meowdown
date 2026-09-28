import type { MarkdownNode } from './types.ts'

/**
 * Child indexes from the document root. Valid only for the tree that produced them.
 */
export type MarkdownAstPath = readonly number[]

/**
 * A node and its address in a depth-first traversal; the root has no parent or index.
 * For `+ [ ] parent\n  + [ ] child`, the child item has path `[0, 1]`,
 * parent equal to the outer item, and index `1` (after its paragraph at `0`).
 * Node references remain usable during edits; paths and indexes must be recomputed
 * after inserting, removing, or moving siblings. Do not mutate during traversal.
 */
export interface MarkdownAstEntry {
  node: MarkdownNode
  parent: MarkdownNode | undefined
  index: number | undefined
  path: MarkdownAstPath
}

function* visit(entry: MarkdownAstEntry): Generator<MarkdownAstEntry> {
  yield entry
  const children = entry.node.children
  if (!children) return
  for (let index = 0; index < children.length; index++) {
    yield* visit({
      node: children[index],
      parent: entry.node,
      index,
      path: [...entry.path, index],
    })
  }
}

/**
 * Visit the root and every descendant, including table rows and cells, in document order.
 */
export function* walkMarkdownAst(root: MarkdownNode): Generator<MarkdownAstEntry> {
  yield* visit({ node: root, parent: undefined, index: undefined, path: [] })
}

/**
 * Resolve an address against its original tree; malformed or missing addresses return undefined.
 */
export function resolveMarkdownAstPath(
  root: MarkdownNode,
  path: MarkdownAstPath,
): MarkdownAstEntry | undefined {
  let node = root
  let parent: MarkdownNode | undefined
  let index: number | undefined
  for (const childIndex of path) {
    if (!Number.isSafeInteger(childIndex) || childIndex < 0) return
    const child = node.children?.[childIndex]
    if (!child) return
    parent = node
    index = childIndex
    node = child
  }
  return { node, parent, index, path: [...path] }
}
