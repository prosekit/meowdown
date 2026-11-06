import type { EditorState, Transaction } from '@prosekit/pm/state'
import type { DecorationSource } from '@prosekit/pm/view'

type AppendTransaction = (
  transactions: readonly Transaction[],
  oldState: EditorState,
  newState: EditorState,
) => Transaction | null | undefined

type Decorations = (state: EditorState) => DecorationSource | null | undefined

/**
 * Wrap an `appendTransaction` so that a throw is reported with `reportError`
 * and appends nothing. Otherwise the whole dispatch fails, and text the
 * browser already inserted never reaches the editor state.
 */
export function guardAppendTransaction(appendTransaction: AppendTransaction): AppendTransaction {
  return (transactions, oldState, newState) => {
    try {
      return appendTransaction(transactions, oldState, newState)
    } catch (error) {
      reportError(error)
      return null
    }
  }
}

/**
 * Wrap a `decorations` prop so that a throw is reported with `reportError` and
 * draws no decorations. ProseMirror reads decorations in the middle of a view
 * update and in `EditorView.destroy`, where a throw leaves the view half
 * updated.
 */
export function guardDecorations(decorations: Decorations): Decorations {
  return (state) => {
    try {
      return decorations(state)
    } catch (error) {
      reportError(error)
      return null
    }
  }
}
