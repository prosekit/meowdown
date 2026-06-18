import { definePlugin, type PlainExtension } from '@prosekit/core'
import type { EditorNode, Mark, Slice } from '@prosekit/pm/model'
import type { EditorState } from '@prosekit/pm/state'
import { Plugin, PluginKey } from '@prosekit/pm/state'
import { Decoration, DecorationSet } from '@prosekit/pm/view'

import type { MarkName } from './mark-names.ts'

/**
 * Controls how markdown syntax characters are rendered and how the
 * editor serializes content to the clipboard.
 *
 * - 'hide':  syntax chars never visible; copy strips them.
 * - 'focus': syntax chars hidden by default; revealed near cursor; copy strips them.
 * - 'show':  syntax chars always visible (dim grey); copy keeps them.
 */
export type MarkMode = 'hide' | 'focus' | 'show'

// Marks whose presence at the caret reveals the surrounding markdown syntax in
// focus mode.
const REVEAL_TRIGGERING_MARKS: ReadonlySet<MarkName> = new Set<MarkName>([
  'mdStrong',
  'mdEm',
  'mdCode',
  'mdDel',
  'mdLinkText',
  'mdLinkUri',
  // Reveals the raw `[[target]]` when the caret is at the wikilink source.
  'mdWikilinkSource',
  // Reveals the raw `![alt](url)` when the caret is anywhere in the image
  // source, including its plain alt text (which carries only mdImageSource).
  'mdImageSource',
])

// The hidden marks individually decorated `.show` within a revealed range: the
// syntax punctuation and the bare URL.
const REVEALABLE_MARK_NAMES: ReadonlySet<MarkName> = new Set<MarkName>(['mdMark', 'mdLinkUri'])

// Marks whose text is dropped from a clean clipboard copy, so copied markdown
// omits the rendered syntax. Source marks are exempt (see `cleanCopySerializer`).
const CLIPBOARD_STRIP_MARK_NAMES: ReadonlySet<MarkName> = new Set<MarkName>(['mdMark', 'mdLinkUri'])

// Source marks whose whole run is kept verbatim in a clean copy, so a rendered
// image stays `![alt](url)` and a rendered wikilink stays `[[target]]`, even
// though their punctuation/url carry otherwise-stripped marks.
const CLIPBOARD_KEEP_SOURCE_MARK_NAMES: ReadonlySet<MarkName> = new Set<MarkName>([
  'mdImageSource',
  'mdWikilinkSource',
])

// Marks that make a text node part of a link; revealing one reveals the whole
// link (text + URL) envelope.
const LINK_BEARING_MARKS: ReadonlySet<MarkName> = new Set<MarkName>(['mdLinkText', 'mdLinkUri'])

// Marks that carry their own inline formatting (not bare punctuation), used to
// test link-envelope membership.
const SYNTAX_BEARING_MARKS: ReadonlySet<MarkName> = new Set<MarkName>([
  'mdStrong',
  'mdEm',
  'mdCode',
  'mdDel',
  'mdWikilinkSource',
])

const markModeKey = new PluginKey<MarkMode>('mark-mode')

function createMarkModePlugin(mode: MarkMode): Plugin<MarkMode> {
  return new Plugin<MarkMode>({
    key: markModeKey,
    state: {
      init: () => mode,
      apply: (_tr, value) => value,
    },
    props: {
      attributes: { 'data-mark-mode': mode },
      decorations: mode === 'focus' ? (state) => computeFocusDecorations(state) : undefined,
      clipboardTextSerializer: mode === 'show' ? undefined : cleanCopySerializer,
    },
  })
}

export function defineMarkMode(mode: MarkMode): PlainExtension {
  return definePlugin(createMarkModePlugin(mode))
}

/** The active mark mode, or `undefined` when `defineMarkMode` is not applied. */
export function getMarkMode(state: EditorState): MarkMode | undefined {
  return markModeKey.getState(state)
}

function cleanCopySerializer(slice: Slice): string {
  const blocks: string[] = []
  slice.content.forEach((blockNode) => {
    const parts: string[] = []
    blockNode.descendants((textNode) => {
      if (!textNode.isText || !textNode.text) return true
      const isKeptSource = textNode.marks.some((m: Mark) =>
        CLIPBOARD_KEEP_SOURCE_MARK_NAMES.has(m.type.name as MarkName),
      )
      const stripped =
        !isKeptSource &&
        textNode.marks.some((m: Mark) => CLIPBOARD_STRIP_MARK_NAMES.has(m.type.name as MarkName))
      if (!stripped) parts.push(textNode.text)
      return false
    })
    blocks.push(parts.join(''))
  })
  // Single '\n' between blocks (not '\n\n'): output mirrors "what the user
  // sees on screen", not the markdown paragraph convention.
  return blocks.join('\n')
}

function computeFocusDecorations(state: EditorState): DecorationSet | undefined {
  const { $anchor, empty } = state.selection
  if (!empty) return DecorationSet.empty

  const textblock = $anchor.parent
  if (!textblock.isTextblock) return undefined

  const textblockStart = $anchor.start()
  const parentOffset = $anchor.parentOffset
  const triggeringMarks = collectAdjacentTriggeringMarks(textblock, parentOffset)
  if (triggeringMarks.size === 0) return DecorationSet.empty

  const ranges: Array<[number, number]> = []
  const seen = new Set<string>()
  let didLinkEnvelope = false
  for (const mark of triggeringMarks) {
    if (LINK_BEARING_MARKS.has(mark)) {
      if (didLinkEnvelope) continue
      didLinkEnvelope = true
      expandLinkEnvelope(textblock, textblockStart, parentOffset, ranges, seen)
    } else {
      expandRangeAndCollect(textblock, textblockStart, mark, parentOffset, ranges, seen)
    }
  }
  const decorations = ranges.map(([from, to]) => Decoration.inline(from, to, { class: 'show' }))
  return DecorationSet.create(state.doc, decorations)
}

function collectAdjacentTriggeringMarks(
  textblock: EditorNode,
  parentOffset: number,
): Set<MarkName> {
  const out = new Set<MarkName>()
  let pos = 0
  textblock.forEach((child: EditorNode) => {
    const childEnd = pos + child.nodeSize
    if (parentOffset >= pos && parentOffset <= childEnd) {
      for (const mark of child.marks) {
        const name = mark.type.name as MarkName
        if (REVEAL_TRIGGERING_MARKS.has(name)) out.add(name)
      }
    }
    pos = childEnd
  })
  return out
}

function expandRangeAndCollect(
  textblock: EditorNode,
  textblockStart: number,
  triggerMark: MarkName,
  parentOffset: number,
  out: Array<[number, number]>,
  seen: Set<string>,
): void {
  let pos = textblockStart
  let parentPos = 0
  let runStart = -1
  let runStartParent = -1
  textblock.forEach((child: EditorNode) => {
    const has = child.marks.some((m: Mark) => m.type.name === triggerMark)
    if (has && runStart === -1) {
      runStart = pos
      runStartParent = parentPos
    }
    if (!has && runStart !== -1) {
      if (parentOffset >= runStartParent && parentOffset <= parentPos) {
        decorateMarkersInRange(textblock, textblockStart, runStart, pos, out, seen)
      }
      runStart = -1
      runStartParent = -1
    }
    pos += child.nodeSize
    parentPos += child.nodeSize
  })
  if (runStart !== -1) {
    if (parentOffset >= runStartParent && parentOffset <= parentPos) {
      decorateMarkersInRange(textblock, textblockStart, runStart, pos, out, seen)
    }
  }
}

function expandLinkEnvelope(
  textblock: EditorNode,
  textblockStart: number,
  parentOffset: number,
  out: Array<[number, number]>,
  seen: Set<string>,
): void {
  const childCount = textblock.childCount
  if (childCount === 0) return

  let triggerIdx = -1
  let pos = 0
  for (let i = 0; i < childCount; i++) {
    const child = textblock.child(i)
    const childEnd = pos + child.nodeSize
    if (parentOffset >= pos && parentOffset <= childEnd) {
      if (child.marks.some((m: Mark) => LINK_BEARING_MARKS.has(m.type.name as MarkName))) {
        triggerIdx = i
        break
      }
    }
    pos = childEnd
  }
  if (triggerIdx === -1) return

  let left = triggerIdx
  while (left > 0 && isLinkEnvelopeMember(textblock.child(left - 1))) {
    left--
  }
  let right = triggerIdx
  while (right < childCount - 1 && isLinkEnvelopeMember(textblock.child(right + 1))) {
    right++
  }

  let envStart = textblockStart
  for (let i = 0; i < left; i++) envStart += textblock.child(i).nodeSize
  let envEnd = envStart
  for (let i = left; i <= right; i++) envEnd += textblock.child(i).nodeSize

  decorateMarkersInRange(textblock, textblockStart, envStart, envEnd, out, seen)
}

function isLinkEnvelopeMember(child: EditorNode): boolean {
  let hasMdMark = false
  let hasLinkMark = false
  let hasOtherSemantic = false
  for (const mark of child.marks) {
    const name = mark.type.name as MarkName
    if (name === 'mdMark') hasMdMark = true
    else if (LINK_BEARING_MARKS.has(name)) hasLinkMark = true
    else if (SYNTAX_BEARING_MARKS.has(name)) hasOtherSemantic = true
  }
  if (hasLinkMark) return true
  if (hasMdMark && !hasOtherSemantic) return true
  return false
}

function decorateMarkersInRange(
  textblock: EditorNode,
  textblockStart: number,
  rangeFrom: number,
  rangeTo: number,
  out: Array<[number, number]>,
  seen: Set<string>,
): void {
  let pos = textblockStart
  textblock.forEach((child: EditorNode) => {
    const childStart = pos
    const childEnd = pos + child.nodeSize
    if (childStart >= rangeFrom && childEnd <= rangeTo) {
      for (const mark of child.marks) {
        const name = mark.type.name as MarkName
        if (REVEALABLE_MARK_NAMES.has(name)) {
          const key = `${childStart}_${childEnd}`
          if (!seen.has(key)) {
            seen.add(key)
            out.push([childStart, childEnd])
          }
          break
        }
      }
    }
    pos = childEnd
  })
}
