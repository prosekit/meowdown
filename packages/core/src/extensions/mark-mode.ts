import { defineCommands, definePlugin, getMarkType, union } from '@prosekit/core'
import type { Mark, MarkType, ResolvedPos } from '@prosekit/pm/model'
import type { Command, EditorState } from '@prosekit/pm/state'
import { Plugin, PluginKey } from '@prosekit/pm/state'
import { Decoration, DecorationSet } from '@prosekit/pm/view'

import { ATOM_PACK_KEYS, type MarkName } from './mark-names.ts'

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
        if (mode === 'focus') return computeFocusDecorations(state)
        // Hide mode never reveals ordinary syntax, but a math unit hides its
        // content too, so without a reveal it could not be edited in place.
        if (mode === 'hide') return computeMathRevealDecorations(state)
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

/**
 * In focus mode, reveal the markdown syntax of the inline unit under the caret.
 *
 * Every revealable unit (emphasis, strong, code, strikethrough, link, autolink,
 * image) carries one `mdPack` mark spanning it, so a single boundary-inclusive
 * `getMarkRange` finds the unit, returning the outermost when units nest. One
 * decoration over its range flips the hidden punctuation/url/source visible via
 * the `.show` CSS rule. Because the range covers the whole unit, a caret at
 * either edge (e.g. right after a link's `)`) still reveals it. Atom packs
 * (`ATOM_PACK_KEYS`) and `#tag` never reveal.
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

  const range = getRevealablePackRange(
    $pos,
    getMarkType(state.schema, 'mdPack' satisfies MarkName),
    packAttrs,
  )
  if (!range) return DecorationSet.empty

  return DecorationSet.create(state.doc, [
    Decoration.inline(range.from, range.to, { class: 'show' }),
  ])
}

// The outermost revealable pack touching `$pos`, preferring the child to the
// right like `getMarkRange`. An atom pack hides its source behind a preview
// and never reveals, so it must not shadow a revealable neighbour on the
// other side of the caret.
function getRevealablePackRange(
  $pos: ResolvedPos,
  packType: MarkType,
  packAttrs: Record<string, unknown> | undefined,
): { from: number; to: number } | undefined {
  const matchesPack = (mark: Mark): boolean =>
    mark.type === packType &&
    !ATOM_PACK_KEYS.has(mark.attrs.key as string) &&
    (packAttrs == null ||
      Object.entries(packAttrs).every(([name, value]) => mark.attrs[name] === value))

  const parent = $pos.parent
  const after = parent.childAfter($pos.parentOffset)
  const before = parent.childBefore($pos.parentOffset)
  let index: number
  let offset: number
  let mark: Mark | undefined
  if (after.node && (mark = after.node.marks.find(matchesPack))) {
    index = after.index
    offset = after.offset
  } else if (before.node && (mark = before.node.marks.find(matchesPack))) {
    index = before.index
    offset = before.offset
  } else {
    return
  }

  const start = $pos.start()
  let from = start + offset
  let to = from + parent.child(index).nodeSize
  for (let i = index - 1; i >= 0 && mark.isInSet(parent.child(i).marks); i--) {
    from -= parent.child(i).nodeSize
  }
  for (let i = index + 1; i < parent.childCount && mark.isInSet(parent.child(i).marks); i++) {
    to += parent.child(i).nodeSize
  }
  return { from, to }
}
