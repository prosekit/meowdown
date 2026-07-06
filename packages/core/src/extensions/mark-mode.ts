import { defineCommands, definePlugin, getMarkRange, getMarkType, union } from '@prosekit/core'
import type { Mark, Slice } from '@prosekit/pm/model'
import type { Command, EditorState } from '@prosekit/pm/state'
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
// omits the rendered syntax. The image/wikilink sources carry only their own
// mark, so they are kept verbatim (`![alt](url)`, `[[target]]`).
const CLIPBOARD_STRIP_MARK_NAMES: ReadonlySet<MarkName> = new Set<MarkName>([
  'mdMark',
  'mdLinkUri',
  'mdLinkTitle',
])

// Marks whose text survives a clean copy even when a strip mark also covers
// it. A math dollar carries `mdMark` for hiding, but stripping it would paste
// bare TeX; `$E=mc^2$` should copy whole, like an image source.
const CLIPBOARD_KEEP_MARK_NAMES: ReadonlySet<MarkName> = new Set<MarkName>(['mdMath'])

const markModeKey = new PluginKey<MarkMode>('mark-mode')

function getCurrentMarkMode(state: EditorState): MarkMode | undefined {
  return markModeKey.getState(state)
}

function createMarkModePlugin(initialMode: MarkMode): Plugin<MarkMode> {
  return new Plugin<MarkMode>({
    key: markModeKey,
    state: {
      init: () => initialMode,
      apply: (tr, value) => (tr.getMeta(markModeKey) as MarkMode | undefined) ?? value,
    },
    props: {
      attributes: (state) => {
        return { 'data-mark-mode': getCurrentMarkMode(state) ?? initialMode }
      },
      decorations: (state) => {
        const mode = getCurrentMarkMode(state)
        if (mode === 'focus') return computeFocusDecorations(state)
        // Hide mode never reveals ordinary syntax, but a math unit hides its
        // content too, so without a reveal it could not be edited in place.
        if (mode === 'hide') return computeMathRevealDecorations(state)
        return
      },
      // In show mode the empty string is falsy, so `someProp` falls through to
      // the next serializer (`defineMarkdownCopy` in the full editor) and the
      // copied text keeps the syntax.
      clipboardTextSerializer: (slice, view) => {
        return getCurrentMarkMode(view.state) === 'show' ? '' : cleanCopySerializer(slice)
      },
    },
  })
}

function setMarkMode(mode: MarkMode): Command {
  return (state, dispatch) => {
    if (getMarkMode(state) === mode) return false
    // A meta-only transaction: no doc steps, so undo cannot revert the mode.
    dispatch?.(state.tr.setMeta(markModeKey, mode))
    return true
  }
}

export function defineMarkMode(mode: MarkMode) {
  return union(definePlugin(createMarkModePlugin(mode)), defineCommands({ setMarkMode }))
}

/**
 * The active mark mode. `defineEditorExtension` always applies
 * `defineMarkMode`, so this is `undefined` only for a state built without it.
 */
export function getMarkMode(state: EditorState): MarkMode | undefined {
  return markModeKey.getState(state)
}

function cleanCopySerializer(slice: Slice): string {
  const blocks: string[] = []
  slice.content.forEach((blockNode) => {
    const parts: string[] = []
    blockNode.descendants((textNode) => {
      if (!textNode.isText || !textNode.text) return true
      const stripped =
        textNode.marks.some((m: Mark) => CLIPBOARD_STRIP_MARK_NAMES.has(m.type.name as MarkName)) &&
        !textNode.marks.some((m: Mark) => CLIPBOARD_KEEP_MARK_NAMES.has(m.type.name as MarkName))
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
  return computeRevealDecorations(state, undefined)
}

/**
 * In hide mode, reveal only the math unit under the caret. A math unit hides
 * its whole source (content included), so it is the one construct that must
 * still reveal in hide mode to stay editable; everything else follows the
 * hide-mode contract and never reveals.
 */
function computeMathRevealDecorations(state: EditorState): DecorationSet {
  return computeRevealDecorations(state, { key: 'math' })
}

function computeRevealDecorations(
  state: EditorState,
  packAttrs: Record<string, unknown> | undefined,
): DecorationSet {
  const { selection } = state
  if (!selection.empty) return DecorationSet.empty

  const $pos = selection.$head
  const { parent } = $pos
  if (!parent.isTextblock || parent.type.spec.code) return DecorationSet.empty

  const range = getMarkRange(
    $pos,
    getMarkType(state.schema, 'mdPack' satisfies MarkName),
    packAttrs,
  )
  if (!range) return DecorationSet.empty

  return DecorationSet.create(state.doc, [
    Decoration.inline(range.from, range.to, { class: 'show' }),
  ])
}
