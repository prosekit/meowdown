import { definePlugin, getNodeType, isTextSelection, type PlainExtension } from '@prosekit/core'
import { Fragment, Slice } from '@prosekit/pm/model'
import type { ProseMirrorNode, ResolvedPos, Schema } from '@prosekit/pm/model'
import { Plugin, PluginKey, type Selection } from '@prosekit/pm/state'

import { docToMarkdown } from '../../converters/pm-to-md.ts'
import type { MdWikilinkAttrs } from '../inline-marks.ts'
import { groupInlineRuns, hasSyntaxMark } from '../inline-runs.ts'
import { getMarkMode } from '../mark-mode.ts'
import { isMarkOfType } from '../mark-names.ts'
import type { NodeName } from '../node-names.ts'

/**
 * Serialize a slice to Markdown. Incomplete top-level edge blocks are flattened
 * to paragraphs so their unselected markers are not synthesized. Complete edge
 * blocks and every middle block keep their Markdown structure.
 */
function sliceToMarkdown(schema: Schema, slice: Slice, selection: Selection): string {
  const fragment = normalizeOpenEdges(schema, slice, selection)
  let doc: ProseMirrorNode | undefined
  try {
    doc = schema.topNodeType.createAndFill(undefined, fragment) ?? undefined
  } catch {
    doc = undefined
  }
  if (!doc) return fragment.textBetween(0, fragment.size, '\n', '\n')
  return docToMarkdown(doc).replace(/\n+$/, '')
}

function normalizeOpenEdges(schema: Schema, slice: Slice, selection: Selection): Fragment {
  const { content, openStart, openEnd } = slice
  if (content.childCount === 0 || (openStart === 0 && openEnd === 0)) return content

  const includesFirstBlockStart =
    isTextSelection(selection) && isAtTopLevelBlockStart(selection.$from)
  const includesLastBlockEnd = isTextSelection(selection) && isAtTopLevelBlockEnd(selection.$to)
  const lastIndex = content.childCount - 1
  const nodes: ProseMirrorNode[] = []

  content.forEach((node, _offset, index) => {
    const incompleteStart = index === 0 && openStart > 0 && !includesFirstBlockStart
    const incompleteEnd = index === lastIndex && openEnd > 0 && !includesLastBlockEnd
    nodes.push(incompleteStart || incompleteEnd ? flattenToParagraph(schema, node) : node)
  })
  return Fragment.from(nodes)
}

function flattenToParagraph(schema: Schema, node: ProseMirrorNode): ProseMirrorNode {
  const paragraphType = getNodeType(schema, 'paragraph' satisfies NodeName)
  const text = node.textBetween(0, node.content.size, '\n', '\n')
  return paragraphType.create(undefined, text ? schema.text(text) : undefined)
}

function isAtTopLevelBlockStart($pos: ResolvedPos): boolean {
  if ($pos.depth === 0) return true
  if ($pos.parentOffset !== 0) return false
  for (let depth = 1; depth < $pos.depth; depth++) {
    if ($pos.index(depth) !== 0) return false
  }
  return true
}

function isAtTopLevelBlockEnd($pos: ResolvedPos): boolean {
  if ($pos.depth === 0) return true
  if ($pos.parentOffset !== $pos.parent.content.size) return false
  for (let depth = 1; depth < $pos.depth; depth++) {
    if ($pos.indexAfter(depth) !== $pos.node(depth).childCount) return false
  }
  return true
}

/**
 * The `text/plain` flavor is Markdown: complete blocks keep their markers,
 * while incomplete selection edges contain only the selected text. The mark
 * mode decides the inline layer: hide strips syntax characters, while focus
 * and show keep the full source.
 */
export function definePlainTextSerializer(): PlainExtension {
  return definePlugin(
    new Plugin({
      key: new PluginKey('meowdown-plain-text-copy'),
      props: {
        clipboardTextSerializer: (slice, view) => {
          const hide = getMarkMode(view.state) === 'hide'
          const cleaned = hide ? stripHiddenInline(slice) : slice
          return sliceToMarkdown(view.state.schema, cleaned, view.state.selection)
        },
      },
    }),
  )
}

/** Drop the inline text a hide-mode editor never shows. */
function stripHiddenInline(slice: Slice): Slice {
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
      if (isMarkOfType(atom, 'mdWikilink')) {
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
