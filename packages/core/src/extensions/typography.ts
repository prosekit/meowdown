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

interface TypographyReplacement {
  input: string
  replacement: string
}

const TYPOGRAPHY_REPLACEMENTS: TypographyReplacement[] = [
  { input: '<-', replacement: '←' },
  { input: '->', replacement: '→' },
  { input: '(c)', replacement: '©' },
  { input: '(r)', replacement: '®' },
  { input: '1/2', replacement: '½' },
  // Reflect included an inner `$` here, making its whitespace-wrapped rule impossible to match.
  { input: '+/-', replacement: '±' },
  { input: '!=', replacement: '≠' },
  { input: '<<', replacement: '«' },
  { input: '>>', replacement: '»' },
  { input: '--', replacement: '—' },
]

function escapeRegexp(input: string): string {
  return input.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
}

interface TypographyUndoState {
  from: number
  to: number
  before: string
  after: string
}

const typographyUndoKey = new PluginKey<TypographyUndoState | null>('meowdown-typography-undo')

function isInlineCode(state: EditorState, from: number, to: number): boolean {
  const type = state.schema.marks.mdCode
  return !!type && state.doc.rangeHasMark(from, to, type)
}

function replaceTypography(
  state: EditorState,
  from: number,
  to: number,
  replacement: string,
  undoText?: string,
): Transaction | null {
  if (isInlineCode(state, from, to)) return null
  const text = undoText == null ? replacement : `${replacement} `
  const tr = state.tr.replaceWith(from, to, state.schema.text(text))
  if (undoText != null) {
    tr.setMeta(typographyUndoKey, {
      from,
      to: from + text.length,
      before: undoText,
      after: text,
    } satisfies TypographyUndoState)
  }
  return tr
}

function defineTypographyInputRules(): PlainExtension {
  return union(
    TYPOGRAPHY_REPLACEMENTS.map(({ input, replacement }) => {
      const inputRegexp = new RegExp(String.raw`(${escapeRegexp(input)})\s$`)
      return defineInputRule(
        new InputRule(inputRegexp, (state, match, start, end) => {
          return replaceTypography(state, start, end, replacement, match[0])
        }),
      )
    }),
  )
}

function defineTypographyUndo(): PlainExtension {
  return union(
    definePlugin(
      new Plugin<TypographyUndoState | null>({
        key: typographyUndoKey,
        state: {
          init: () => null,
          apply: (tr, previous) => {
            const meta = tr.getMeta(typographyUndoKey) as TypographyUndoState | null | undefined
            if (meta !== undefined) return meta
            if (!previous) return null

            const from = tr.mapping.map(previous.from)
            const to = tr.mapping.map(previous.to)
            const stillImmediatelyAfterReplacement =
              tr.selection.empty &&
              tr.selection.from === to &&
              tr.doc.textBetween(from, to) === previous.after
            return stillImmediatelyAfterReplacement ? { ...previous, from, to } : null
          },
        },
      }),
    ),
    withPriority(
      defineKeymap({
        Backspace: (state, dispatch) => {
          const undo = typographyUndoKey.getState(state)
          if (!undo) return false
          dispatch?.(
            state.tr
              .replaceWith(undo.from, undo.to, state.schema.text(undo.before))
              .setMeta(typographyUndoKey, null),
          )
          return true
        },
      }),
      Priority.highest,
    ),
  )
}

function defineTypographyEnterRules(): PlainExtension {
  return union(
    TYPOGRAPHY_REPLACEMENTS.map(({ input, replacement }) => {
      return defineEnterRule({
        regex: new RegExp(`${escapeRegexp(input)}$`),
        handler: ({ state, from, to }) => replaceTypography(state, from, to, replacement),
      })
    }),
  )
}

/** Apply the editor's automatic plain-text typography replacements. */
export function defineTypography(): PlainExtension {
  return union(defineTypographyInputRules(), defineTypographyUndo(), defineTypographyEnterRules())
}
