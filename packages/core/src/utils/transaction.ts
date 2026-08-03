import type { Transaction } from '@prosekit/pm/state'

/**
 * Whether the given transaction is selection transactions directly caused by mouse or touch input.
 *
 * See https://code.haverbeke.berlin/prosemirror/prosemirror-view/src/tag/1.42.2/src/input.ts#L191
 */
function isPointerSelectionTransaction(tr: Transaction): boolean {
  return !!tr.getMeta('pointer')
}

/**
 * Whether any of the given transactions are selection transactions directly caused by mouse or touch input.
 */
export function hasPointerSelectionTransaction(transactions: readonly Transaction[]): boolean {
  return transactions.some(isPointerSelectionTransaction)
}
