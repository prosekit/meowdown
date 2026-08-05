import { defineCommands, definePlugin, getMarkRange, union } from '@prosekit/core'
import type { Mark, ResolvedPos } from '@prosekit/pm/model'
import type { Command, EditorState } from '@prosekit/pm/state'
import { Plugin, PluginKey } from '@prosekit/pm/state'
import { Decoration, DecorationSet } from '@prosekit/pm/view'

import type { MdPackAttrs } from './inline-marks.ts'
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
        const mode = getCurrentMarkMode(state) ?? initialMode
        return mode === 'focus' || mode === 'hide'
          ? computeRevealDecorations(state, mode)
          : undefined
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

// The revealable pack touching `$pos` from `direction`: the outermost pack
// on the neighbouring node declaring the flag `mode` honours (outer packs
// sort before inner ones in a node's marks, so `find` keeps nested units
// revealing as their enclosing unit). The units that opt into a hide-mode
// reveal hide content, not just syntax, and could not be edited in place
// otherwise; show mode reveals through CSS alone and declares no flag.
function findRevealablePack(
  $pos: ResolvedPos,
  mode: 'focus' | 'hide',
  direction: -1 | 1,
): Mark | undefined {
  const { parent } = $pos
  if (!parent.isTextblock || parent.type.spec.code) return

  const node = direction === -1 ? $pos.nodeBefore : $pos.nodeAfter
  for (const mark of node?.marks ?? []) {
    if (isMarkOfType(mark, 'mdPack')) {
      const attrs = mark.attrs as MdPackAttrs
      if ((mode === "focus" && attrs.revealInFocus) || (mode === "hide" && attrs.revealInHide)) {
        return mark
      }
    }
  }
}

/**
 * Reveal the markdown syntax of the inline units the selection touches: the
 * unit before its start and the unit after its end, which for a caret are
 * the two units meeting at it.
 *
 * Every unit carries one `mdPack` mark spanning it, so one `getMarkRange`
 * per probed pack expands it to its whole unit, and one decoration over
 * each range flips the hidden punctuation/url/source visible via the `.show`
 * CSS rule. The two probes land on the same unit when the selection sits
 * inside one (equal ranges dedupe to one decoration), and on two units at a
 * shared boundary, so the characters an edit would touch are never hidden.
 * `#tag` carries no pack and never reveals.
 */
function computeRevealDecorations(
  state: EditorState,
  mode: 'focus' | 'hide',
): DecorationSet | undefined {
  const { $from, $to } = state.selection
  const packBefore = findRevealablePack($from, mode, -1)
  const packAfter = findRevealablePack($to, mode, 1)

  const decorations: Decoration[] = []
  for (const [$pos, pack] of [
    [$from, packBefore],
    [$to, packAfter],
  ] as const) {
    if (pack == null) continue
    const range = getMarkRange($pos, 'mdPack' satisfies MarkName, pack.attrs)
    if (range == null) continue
    if (decorations.some((deco) => deco.from === range.from && deco.to === range.to)) continue
    decorations.push(Decoration.inline(range.from, range.to, { class: 'show' }))
  }
  if (decorations.length === 0) return

  return DecorationSet.create(state.doc, decorations)
}

export function defineMarkMode(mode: MarkMode) {
  return union(definePlugin(createMarkModePlugin(mode)), defineCommands({ setMarkMode }))
}
