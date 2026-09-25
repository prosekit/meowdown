import type { Transaction } from '@prosekit/pm/state'

import { getIsPointerSelection } from './input-modality.ts'

/**
 * Whether any of the given transactions are selection transactions directly caused by mouse or touch input.
 */
export function hasPointerSelectionTransaction(transactions: readonly Transaction[]): boolean {
  return getIsPointerSelection() && transactions.some((tr) => tr.selectionSet && !tr.docChanged)
}
