import type { Mark } from '@prosekit/pm/model'

/**
 * Position-wise equality on two mark arrays. Returns `true` only when
 * the arrays have the same length and `a[i].eq(b[i])` for every index.
 */
export function marksEqual(a: readonly Mark[], b: readonly Mark[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (!a[i].eq(b[i])) return false
  }
  return true
}
