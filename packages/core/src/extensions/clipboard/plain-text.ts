import { definePlugin, getNodeType, isTextSelection, type PlainExtension } from '@prosekit/core'
import { Fragment, Slice } from '@prosekit/pm/model'
import type { ProseMirrorNode, Schema } from '@prosekit/pm/model'
import { Plugin, PluginKey, type Selection } from '@prosekit/pm/state'

import { docToMarkdown } from '../../converters/pm-to-md.ts'
import {
  isAtTopLevelBlockEnd,
  isAtTopLevelBlockStart,
} from '../../utils/top-level-block-boundary.ts'
import type { MeowdownHeadingAttrs } from '../heading.ts'
import type { MdWikilinkAttrs } from '../inline-marks.ts'
import { groupInlineRuns, hasSyntaxMark } from '../inline-runs.ts'
import { getMarkMode } from '../mark-mode.ts'
import { isMarkOfType } from '../mark-names.ts'
import { isNodeOfType, type NodeName } from '../node-names.ts'

/**
 * Serialize a slice to Markdown. A block whose content start is not selected is
 * flattened so its opening markers are not synthesized. Incomplete fenced code
 * blocks and tables are also flattened because their markers describe the
 * entire block. Other intact blocks keep opening markers when their content
 * start is selected.
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
    if (incompleteStart) {
      nodes.push(flattenToParagraph(schema, node))
    } else if (incompleteEnd) {
      nodes.push(normalizeIncompleteEnd(schema, node, openEnd))
    } else {
      nodes.push(node)
    }
  })
  return Fragment.from(nodes)
}

/**
 * Follow the open end path and flatten a fenced code block or table found
 * there, retaining any selected container prefixes around it. ATX heading and
 * blockquote markers are opening structure, so a partial content end does not
 * remove them.
 */
function normalizeIncompleteEnd(
  schema: Schema,
  node: ProseMirrorNode,
  openDepth: number,
): ProseMirrorNode {
  if (isNodeOfType(node, 'codeBlock') || isNodeOfType(node, 'table')) {
    return flattenToParagraph(schema, node)
  }
  if (isNodeOfType(node, 'heading')) {
    const attrs = node.attrs as MeowdownHeadingAttrs
    if (attrs.setextUnderline != null) return flattenToParagraph(schema, node)
    if (attrs.closingHashes != null) {
      return node.type.create({ ...attrs, closingHashes: null }, node.content, node.marks)
    }
  }
  if (openDepth <= 1 || node.childCount === 0) return node

  const lastIndex = node.childCount - 1
  const child = node.child(lastIndex)
  const normalized = normalizeIncompleteEnd(schema, child, openDepth - 1)
  return normalized === child ? node : node.copy(node.content.replaceChild(lastIndex, normalized))
}

function flattenToParagraph(schema: Schema, node: ProseMirrorNode): ProseMirrorNode {
  const paragraphType = getNodeType(schema, 'paragraph' satisfies NodeName)
  const text = node.textBetween(0, node.content.size, '\n', '\n')
  return paragraphType.create(undefined, text ? schema.text(text) : undefined)
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
