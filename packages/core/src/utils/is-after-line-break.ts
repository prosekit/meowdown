import type { ResolvedPos } from '@prosekit/pm/model'
import type { EditorState } from '@prosekit/pm/state'

// REVIEW / FIXME: now isAfterLineBreak is useless, remomve it from ther codebase
export function isAfterLineBreak(state: EditorState, pos: number): boolean {
  const $pos = state.doc.resolve(pos)
  const { parentOffset, parent } = $pos
  return parentOffset > 0 && parent.textBetween(parentOffset - 1, parentOffset) === '\n'
}

export function isAfterLineBreak_v2_tmp($pos: ResolvedPos): boolean {
  const { parentOffset, parent } = $pos
  return parentOffset > 0 && parent.textBetween(parentOffset - 1, parentOffset) === '\n'
}
