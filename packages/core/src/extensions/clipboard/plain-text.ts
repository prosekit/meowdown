import { definePlugin, type PlainExtension } from '@prosekit/core'
import { Fragment, Slice } from '@prosekit/pm/model'
import type { ProseMirrorNode, Schema } from '@prosekit/pm/model'
import { Plugin, PluginKey } from '@prosekit/pm/state'

import { docToMarkdown } from '../../converters/pm-to-md.ts'
import type { MdWikilinkAttrs } from '../inline-marks.ts'
import { getMarkMode } from '../mark-mode.ts'
import type { MarkName } from '../mark-names.ts'

import { groupInlineRuns, hasSyntaxMark } from './semantic-inline.ts'

/**
 * Serialize a slice to Markdown. The copied fragment is wrapped in a `doc` so
 * the block serializer can walk it; a purely inline fragment (a
 * partial-paragraph copy) does not fit `doc`'s `block+` content, so it falls
 * back to the inline source text, which is valid inline markdown already.
 */
export function sliceToMarkdown(schema: Schema, slice: Slice): string {
  const fragment = slice.content
  let doc: ProseMirrorNode | undefined
  try {
    doc = schema.topNodeType.createAndFill(undefined, fragment) ?? undefined
  } catch {
    doc = undefined
  }
  if (!doc) return fragment.textBetween(0, fragment.size, '\n', '\n')
  return docToMarkdown(doc).replace(/\n+$/, '')
}

/**
 * The `text/plain` flavor is markdown: block markers always survive, and the
 * mark mode decides the inline layer. In hide mode the inline syntax
 * characters are stripped first, so the copied text matches what is visible;
 * focus and show keep the full source.
 */
export function definePlainTextSerializer(): PlainExtension {
  return definePlugin(
    new Plugin({
      key: new PluginKey('meowdown-plain-text-copy'),
      props: {
        clipboardTextSerializer: (slice, view) => {
          const hide = getMarkMode(view.state) === 'hide'
          const cleaned = hide ? stripHiddenInline(slice) : slice
          return sliceToMarkdown(view.state.schema, cleaned)
        },
      },
    }),
  )
}

/** Drop the inline text a hide-mode editor never shows. */
export function stripHiddenInline(slice: Slice): Slice {
  return new Slice(mapFragment(slice.content), slice.openStart, slice.openEnd)
}

function mapFragment(fragment: Fragment): Fragment {
  const nodes: ProseMirrorNode[] = []
  fragment.forEach((node) => {
    nodes.push(node.isTextblock ? filterTextblock(node) : mapChildren(node))
  })
  return Fragment.from(nodes)
}

function mapChildren(node: ProseMirrorNode): ProseMirrorNode {
  return node.childCount > 0 ? node.copy(mapFragment(node.content)) : node
}

/**
 * Keep the visible inline text: drop syntax characters, replace a wikilink
 * with its display text. An image or math unit renders as a non-text preview,
 * so its source is kept whole; stripping it would paste a bare remainder.
 */
function filterTextblock(textblock: ProseMirrorNode): ProseMirrorNode {
  const schema = textblock.type.schema
  const parts: ProseMirrorNode[] = []
  for (const run of groupInlineRuns(textblock)) {
    const atom = run.atom
    if (atom != null) {
      if (atom.type.name === ('mdWikilink' satisfies MarkName)) {
        const attrs = atom.attrs as MdWikilinkAttrs
        const visible = attrs.display || attrs.target
        if (visible) parts.push(schema.text(visible))
      } else {
        parts.push(...run.children)
      }
      continue
    }
    for (const child of run.children) {
      if (!hasSyntaxMark(child.marks)) parts.push(child)
    }
  }
  return textblock.copy(Fragment.from(parts))
}
