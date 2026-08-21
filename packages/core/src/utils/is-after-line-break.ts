import type { EditorState } from '@prosekit/pm/state'

export function isAfterLineBreak(state: EditorState, pos: number): boolean {
  const $pos = state.doc.resolve(pos)
  const { parentOffset, parent } = $pos
  return parentOffset > 0 && parent.textBetween(parentOffset - 1, parentOffset) === '\n'
}
