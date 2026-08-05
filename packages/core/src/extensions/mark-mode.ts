import { defineCommands, definePlugin, getMarkRange, union } from '@prosekit/core'
import type { Command, EditorState } from '@prosekit/pm/state'
import { Plugin, PluginKey } from '@prosekit/pm/state'
import { Decoration, DecorationSet } from '@prosekit/pm/view'

import type { MdPackAttrs } from './inline-marks.ts'
import type { MarkName } from './mark-names.ts'

/**
 * Controls how markdown syntax characters are rendered and how the clipboard's
 * `text/plain` treats the inline layer (see `definePlainTextSerializer`).
 *
 * - 'hide':  syntax chars never visible; copy strips the inline syntax.
 * - 'focus': syntax chars hidden by default; revealed near cursor; copy keeps them.
 * - 'show':  syntax chars always visible (dim grey); copy keeps them.
 */
export type MarkMode = 'hide' | 'focus' | 'show'

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
        if (mode === 'focus') return computeRevealDecorations(state, { revealInFocus: true })
        // The units that opt into a hide-mode reveal hide content, not just
        // syntax, and could not be edited in place otherwise.
        if (mode === 'hide') return computeRevealDecorations(state, { revealInHide: true })
        return
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

/**
 * The active mark mode. `defineEditorExtension` always applies
 * `defineMarkMode`, so this is `undefined` only for a state built without it.
 */
export function getMarkMode(state: EditorState): MarkMode | undefined {
  return markModeKey.getState(state)
}

/**
 * Reveal the markdown syntax of the inline unit under the caret. `packAttrs`
 * selects the units: each mark mode queries the reveal flag it honours, so
 * only units declaring that flag reveal there.
 *
 * Every unit carries one `mdPack` mark spanning it, so a single
 * boundary-inclusive `getMarkRange` finds the unit, returning the outermost
 * when units nest. One decoration over its range flips the hidden
 * punctuation/url/source visible via the `.show` CSS rule. Because the range
 * covers the whole unit, a caret at either edge (e.g. right after a link's
 * `)`) still reveals it. A pack without the queried flag is skipped; when the
 * pack on one side of the caret is filtered out, `getMarkRange` falls back to
 * the unit touching the caret's other side. `#tag` carries no pack and never
 * reveals.
 */
function computeRevealDecorations(
  state: EditorState,
  packAttrs: Partial<MdPackAttrs>,
): DecorationSet | undefined {
  const { selection } = state
  if (!selection.empty) return

  const $pos = selection.$head
  const { parent } = $pos
  if (!parent.isTextblock || parent.type.spec.code) return DecorationSet.empty

  const range = getMarkRange($pos, 'mdPack' satisfies MarkName, packAttrs)
  if (!range) return

  return DecorationSet.create(state.doc, [
    Decoration.inline(range.from, range.to, { class: 'show' }),
  ])
}

export function defineMarkMode(mode: MarkMode) {
  return union(definePlugin(createMarkModePlugin(mode)), defineCommands({ setMarkMode }))
}
