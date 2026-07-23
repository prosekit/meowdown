import type { ResolvedPos } from '@prosekit/pm/model'

export function isAtTopLevelBlockStart($pos: ResolvedPos): boolean {
  if ($pos.depth === 0) return true
  if ($pos.parentOffset !== 0) return false
  for (let depth = 1; depth < $pos.depth; depth++) {
    if ($pos.index(depth) !== 0) return false
  }
  return true
}

export function isAtTopLevelBlockEnd($pos: ResolvedPos): boolean {
  if ($pos.depth === 0) return true
  if ($pos.parentOffset !== $pos.parent.content.size) return false
  for (let depth = 1; depth < $pos.depth; depth++) {
    if ($pos.indexAfter(depth) !== $pos.node(depth).childCount) return false
  }
  return true
}
