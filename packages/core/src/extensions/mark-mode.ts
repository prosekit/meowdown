import { defineCommands, definePlugin, getMarkRange, union } from '@prosekit/core'
import type { Mark, ProseMirrorNode } from '@prosekit/pm/model'
import type { Command, EditorState } from '@prosekit/pm/state'
import { Plugin, PluginKey } from '@prosekit/pm/state'
import { Decoration, DecorationSet } from '@prosekit/pm/view'

import { isMarkOfType, type MarkName } from './mark-names.ts'

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
        if (mode === 'focus') return computeRevealDecorations(state, 'revealInFocus')
        // The units that opt into a hide-mode reveal hide content, not just
        // syntax, and could not be edited in place otherwise.
        if (mode === 'hide') return computeRevealDecorations(state, 'revealInHide')
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

// The outermost pack on `node` declaring `flag`. Outer packs sort before
// inner ones in a node's marks, so `find` keeps nested units revealing as
// their enclosing unit.
function findFlaggedPack(
  node: ProseMirrorNode | null,
  flag: 'revealInFocus' | 'revealInHide',
): Mark | undefined {
  return node?.marks.find((mark) => isMarkOfType(mark, 'mdPack') && mark.attrs[flag] === true)
}

/**
 * Reveal the markdown syntax of every inline unit touching the caret. Each
 * mark mode queries the reveal flag it honours, so only units declaring that
 * flag reveal there.
 *
 * Every unit carries one `mdPack` mark spanning it, and the caret touches at
 * most two units, one per side, so probe `nodeAfter` and `nodeBefore` for a
 * flagged pack and place one decoration over each distinct unit found; the
 * `.show` CSS rule flips its hidden punctuation/url/source visible. A caret
 * inside a unit sees the same pack on both sides and reveals one unit
 * (adjacent units never carry equal packs; `slot` keeps them apart), while a
 * caret on the boundary between two flagged units reveals both, so the
 * characters a deletion would touch are never hidden. `#tag` carries no pack
 * and never reveals.
 */
function computeRevealDecorations(
  state: EditorState,
  flag: 'revealInFocus' | 'revealInHide',
): DecorationSet | undefined {
  const { selection } = state
  if (!selection.empty) return

  const $pos = selection.$head
  const { parent } = $pos
  if (!parent.isTextblock || parent.type.spec.code) return DecorationSet.empty

  const packAfter = findFlaggedPack($pos.nodeAfter, flag)
  const packBefore = findFlaggedPack($pos.nodeBefore, flag)
  const packs =
    packAfter != null && packBefore != null && !packAfter.eq(packBefore)
      ? [packAfter, packBefore]
      : [packAfter ?? packBefore]

  const decorations: Decoration[] = []
  for (const pack of packs) {
    if (pack == null) continue
    const range = getMarkRange($pos, 'mdPack' satisfies MarkName, pack.attrs)
    if (range) decorations.push(Decoration.inline(range.from, range.to, { class: 'show' }))
  }
  if (decorations.length === 0) return

  return DecorationSet.create(state.doc, decorations)
}

export function defineMarkMode(mode: MarkMode) {
  return union(definePlugin(createMarkModePlugin(mode)), defineCommands({ setMarkMode }))
}
