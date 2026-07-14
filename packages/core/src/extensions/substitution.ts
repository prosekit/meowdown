import {
  defineKeymap,
  definePlugin,
  getMarkType,
  Priority,
  union,
  withPriority,
  type PlainExtension,
} from '@prosekit/core'
import { defineEnterRule } from '@prosekit/extensions/enter-rule'
import { defineInputRule } from '@prosekit/extensions/input-rule'
import { InputRule } from '@prosekit/pm/inputrules'
import { Plugin, PluginKey, type EditorState, type Transaction } from '@prosekit/pm/state'

import type { MarkName } from './mark-names.ts'

type SubstitutionRule = [regexp: RegExp, replacement: string]

const SUBSTITUTION_RULES: SubstitutionRule[] = [
  [/<-/, '←'],
  // `-->` is Markdown's HTML comment closing delimiter.
  [/(?<!-)->/, '→'],
  [/\(c\)/, '©'],
  [/\(r\)/, '®'],
  [/1\/2/, '½'],
  [/\+\/-/, '±'],
  [/!=/, '≠'],
  [/<</, '«'],
  [/>>/, '»'],
  // Keep HTML comment openers and thematic-break markers literal.
  [/(?<!<!)(?<!^(?:-[ \t]*)+)--/, '—'],
]

interface SubstitutionUndoState {
  from: number
  to: number
  before: string
  after: string
}

const substitutionUndoKey = new PluginKey<SubstitutionUndoState | null>(
  'meowdown-substitution-undo',
)

function isInlineCode(state: EditorState, from: number, to: number): boolean {
  const type = getMarkType(state.schema, 'mdCode' satisfies MarkName)
  return state.doc.rangeHasMark(from, to, type)
}

function applySubstitution(
  state: EditorState,
  from: number,
  to: number,
  rule: SubstitutionRule,
  undoText?: string,
): Transaction | null {
  if (isInlineCode(state, from, to)) return null

  const [, replacement] = rule
  const text = undoText == null ? replacement : `${replacement} `
  const tr = state.tr.replaceWith(from, to, state.schema.text(text))
  if (undoText != null) {
    tr.setMeta(substitutionUndoKey, {
      from,
      to: from + text.length,
      before: undoText,
      after: text,
    } satisfies SubstitutionUndoState)
  }
  return tr
}

function defineSubstitutionInputRules(): PlainExtension {
  return union(
    SUBSTITUTION_RULES.map((rule) => {
      const inputRegexp = new RegExp(String.raw`(?:${rule[0].source})\s$`)
      return defineInputRule(
        new InputRule(inputRegexp, (state, match, start, end) => {
          return applySubstitution(state, start, end, rule, match[0])
        }),
      )
    }),
  )
}

function defineSubstitutionUndoPlugin(): PlainExtension {
  return definePlugin(
    new Plugin<SubstitutionUndoState | null>({
      key: substitutionUndoKey,
      state: {
        init: () => null,
        apply: (tr, previous) => {
          // A meta from this extension starts tracking a fresh substitution
          // (a state object) or stops tracking after a Backspace restore (null).
          const meta = tr.getMeta(substitutionUndoKey) as SubstitutionUndoState | null | undefined
          if (meta !== undefined) return meta
          if (!previous) return null

          // Unrelated transaction: re-map the recorded range so it still
          // covers the replacement text in the changed document.
          const from = tr.mapping.map(previous.from)
          const to = tr.mapping.map(previous.to)
          // Keep tracking only while the caret sits right after the untouched
          // replacement; otherwise drop the state so Backspace behaves normally.
          const stillImmediatelyAfterReplacement =
            tr.selection.empty &&
            tr.selection.from === to &&
            tr.doc.textBetween(from, to) === previous.after
          return stillImmediatelyAfterReplacement ? { ...previous, from, to } : null
        },
      },
    }),
  )
}

function defineSubstitutionUndoKeymap(): PlainExtension {
  return withPriority(
    defineKeymap({
      Backspace: (state, dispatch) => {
        const undo = substitutionUndoKey.getState(state)
        if (!undo) return false
        dispatch?.(
          state.tr
            .replaceWith(undo.from, undo.to, state.schema.text(undo.before))
            .setMeta(substitutionUndoKey, null),
        )
        return true
      },
    }),
    Priority.highest,
  )
}

function defineSubstitutionUndo(): PlainExtension {
  return union(defineSubstitutionUndoPlugin(), defineSubstitutionUndoKeymap())
}

function defineSubstitutionEnterRules(): PlainExtension {
  return union(
    SUBSTITUTION_RULES.map((rule) => {
      return defineEnterRule({
        regex: new RegExp(`(?:${rule[0].source})$`),
        handler: ({ state, from, to }) => applySubstitution(state, from, to, rule),
      })
    }),
  )
}

/** Apply the editor's automatic plain-text substitutions. */
export function defineSubstitution(): PlainExtension {
  return union(
    defineSubstitutionInputRules(),
    defineSubstitutionUndo(),
    defineSubstitutionEnterRules(),
  )
}
