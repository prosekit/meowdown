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
  regexp: RegExp
  replacement: string
  shouldSkip?: (textBefore: string) => boolean
}

const TYPOGRAPHY_REPLACEMENTS: TypographyReplacement[] = [
  { regexp: /<-/, replacement: '←' },
  {
    regexp: /->/,
    replacement: '→',
    // `-->` is Markdown's HTML comment closing delimiter.
    shouldSkip: (textBefore) => textBefore.endsWith('-->'),
  },
  { regexp: /\(c\)/, replacement: '©' },
  { regexp: /\(r\)/, replacement: '®' },
  { regexp: /1\/2/, replacement: '½' },
  // Reflect included an inner `$` here, making its whitespace-wrapped rule impossible to match.
  { regexp: /\+\/-/, replacement: '±' },
  { regexp: /!=/, replacement: '≠' },
  { regexp: /<</, replacement: '«' },
  { regexp: />>/, replacement: '»' },
  {
    regexp: /--/,
    replacement: '—',
    // Keep HTML comment openers and thematic-break markers literal.
    shouldSkip: (textBefore) =>
      textBefore.endsWith('<!--') || /^ {0,3}(?:-[ \t]*){3,}$/.test(textBefore),
  },
]

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

function getTextBefore(state: EditorState, position: number): string {
  const $position = state.doc.resolve(position)
  return $position.parent.textBetween(0, $position.parentOffset, null, '\u{FFFC}')
}

function replaceTypography(
  state: EditorState,
  from: number,
  to: number,
  rule: TypographyReplacement,
  undoText?: string,
): Transaction | null {
  if (isInlineCode(state, from, to)) return null
  if (rule.shouldSkip?.(getTextBefore(state, to))) return null

  const { replacement } = rule
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
    TYPOGRAPHY_REPLACEMENTS.map((rule) => {
      const inputRegexp = new RegExp(String.raw`(?:${rule.regexp.source})\s$`)
      return defineInputRule(
        new InputRule(inputRegexp, (state, match, start, end) => {
          return replaceTypography(state, start, end, rule, match[0])
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
    TYPOGRAPHY_REPLACEMENTS.map((rule) => {
      return defineEnterRule({
        regex: new RegExp(`(?:${rule.regexp.source})$`),
        handler: ({ state, from, to }) => replaceTypography(state, from, to, rule),
      })
    }),
  )
}

/** Apply the editor's automatic plain-text typography replacements. */
export function defineTypography(): PlainExtension {
  return union(defineTypographyInputRules(), defineTypographyUndo(), defineTypographyEnterRules())
}
