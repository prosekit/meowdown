import { definePlugin, getMarkRange, getMarkType, type PlainExtension } from '@prosekit/core'
import type { Mark, Slice } from '@prosekit/pm/model'
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

/**
 * In focus mode, reveal the markdown syntax of the inline unit under the caret.
 *
 * Every revealable unit (emphasis, strong, code, strikethrough, link, autolink,
 * image) carries one `mdPack` mark spanning it, so a single boundary-inclusive
 * `getMarkRange` finds the unit, returning the outermost when units nest. One
 * decoration over its range flips the hidden punctuation/url/source visible via
 * the `.show` CSS rule. Because the range covers the whole unit, a caret at
 * either edge (e.g. right after a link's `)`) still reveals it. Wikilink and
 * `#tag` carry no `mdPack`, so they never reveal.
 */
function computeFocusDecorations(state: EditorState): DecorationSet {
  const { selection } = state
  if (!selection.empty) return DecorationSet.empty

  const $pos = selection.$head
  const { parent } = $pos
  if (!parent.isTextblock || parent.type.spec.code) return DecorationSet.empty

  const range = getMarkRange($pos, getMarkType(state.schema, 'mdPack' satisfies MarkName))
  if (!range) return DecorationSet.empty

  return DecorationSet.create(state.doc, [
    Decoration.inline(range.from, range.to, { class: 'show' }),
  ])
}
