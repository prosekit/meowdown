import {
  defineKeymap,
  definePlugin,
  Priority,
  union,
  withPriority,
  type PlainExtension,
} from '@prosekit/core'
import { defineEnterRule } from '@prosekit/extensions/enter-rule'
import { defineInputRule } from '@prosekit/extensions/input-rule'
import { InputRule } from '@prosekit/pm/inputrules'
import { Plugin, PluginKey, type EditorState, type Transaction } from '@prosekit/pm/state'

const LEFT_ARROW_INPUT_PATTERN = /(<-)\s$/

interface LeftArrowUndoState {
  from: number
  to: number
}

const leftArrowUndoKey = new PluginKey<LeftArrowUndoState | null>('meowdown-left-arrow-undo')

function isInlineCode(state: EditorState, from: number, to: number): boolean {
  const type = state.schema.marks.mdCode
  return !!type && state.doc.rangeHasMark(from, to, type)
}

function replaceLeftArrow(
  state: EditorState,
  from: number,
  to: number,
  trailingSpace: boolean,
): Transaction | null {
  if (isInlineCode(state, from, to)) return null
  const text = trailingSpace ? '← ' : '←'
  const tr = state.tr.replaceWith(from, to, state.schema.text(text))
  if (trailingSpace) {
    tr.setMeta(leftArrowUndoKey, { from, to: from + text.length } satisfies LeftArrowUndoState)
  }
  return tr
}

function defineLeftArrowInputRule(): PlainExtension {
  return defineInputRule(
    new InputRule(LEFT_ARROW_INPUT_PATTERN, (state, _match, start, end) => {
      return replaceLeftArrow(state, start, end, true)
    }),
  )
}

function defineLeftArrowUndo(): PlainExtension {
  return union(
    definePlugin(
      new Plugin<LeftArrowUndoState | null>({
        key: leftArrowUndoKey,
        state: {
          init: () => null,
          apply: (tr, previous) => {
            const meta = tr.getMeta(leftArrowUndoKey) as LeftArrowUndoState | null | undefined
            if (meta !== undefined) return meta
            if (!previous) return null

            const from = tr.mapping.map(previous.from)
            const to = tr.mapping.map(previous.to)
            const stillImmediatelyAfterArrow =
              tr.selection.empty &&
              tr.selection.from === to &&
              tr.doc.textBetween(from, to) === '← '
            return stillImmediatelyAfterArrow ? { from, to } : null
          },
        },
      }),
    ),
    withPriority(
      defineKeymap({
        Backspace: (state, dispatch) => {
          const undo = leftArrowUndoKey.getState(state)
          if (!undo) return false
          dispatch?.(
            state.tr
              .replaceWith(undo.from, undo.to, state.schema.text('<- '))
              .setMeta(leftArrowUndoKey, null),
          )
          return true
        },
      }),
      Priority.highest,
    ),
  )
}

function defineLeftArrowEnterRule(): PlainExtension {
  return defineEnterRule({
    regex: /<-$/,
    handler: ({ state, from, to }) => replaceLeftArrow(state, from, to, false),
  })
}

/** Apply the editor's automatic plain-text typography replacements. */
export function defineTypography(): PlainExtension {
  return union(defineLeftArrowInputRule(), defineLeftArrowUndo(), defineLeftArrowEnterRule())
}
