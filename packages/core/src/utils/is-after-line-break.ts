import type { ResolvedPos } from '@prosekit/pm/model'

// REVIEW: FIXME: 1. rename function "isAfterLineBreak_v2_tmp" to isAfterLineBreak
// REVIEW: FIXME: 2. rename this file from  is-after-line-break.ts to link-break.ts
// REVIEW: FIXME: 3. merge the latest origin/master and git push
export function isAfterLineBreak_v2_tmp($pos: ResolvedPos): boolean {
  const { parentOffset, parent } = $pos
  return parentOffset > 0 && parent.textBetween(parentOffset - 1, parentOffset) === '\n'
}
