import { gfmParser } from './parser.ts'

/**
 * Narrow shape for `parser.parseInline()`'s returned elements.
 *
 * `type` / `from` / `to` are part of `@lezer/markdown`'s published
 * `Element` class. `children` exists at runtime but is marked
 * `@internal` upstream and is therefore not in the `.d.ts`. This
 * interface is the narrowest contract we can write to access it.
 */
export interface InlineElement {
  readonly type: number
  readonly from: number
  readonly to: number
  readonly children: readonly InlineElement[]
}

/**
 * Run `gfmParser`'s inline phase on a string and return the top-level
 * inline elements. Wraps the cast that's needed because Lezer's
 * `parseInline` is typed as returning `Element[]` (with `children`
 * marked `@internal`).
 */
export function parseInline(text: string): readonly InlineElement[] {
  return gfmParser.parseInline(text, 0) as InlineElement[]
}

/** Depth-first list of every element matching `test`. */
export function collectInlineElements(
  nodes: readonly InlineElement[],
  test: (node: InlineElement) => boolean,
  out: InlineElement[] = [],
): InlineElement[] {
  for (const node of nodes) {
    if (test(node)) out.push(node)
    collectInlineElements(node.children, test, out)
  }
  return out
}
