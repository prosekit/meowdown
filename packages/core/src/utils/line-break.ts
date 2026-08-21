import type { ResolvedPos } from '@prosekit/pm/model'

export function isAfterLineBreak($pos: ResolvedPos): boolean {
  const { parentOffset, parent } = $pos
  return parentOffset > 0 && parent.textBetween(parentOffset - 1, parentOffset) === '\n'
}
