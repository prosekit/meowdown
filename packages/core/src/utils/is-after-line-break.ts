import type { EditorState } from '@prosekit/pm/state'

export function isAfterLineBreak(state: EditorState, pos: number): boolean {
  const $pos = state.doc.resolve(pos)
  const { parentOffset, parent } = $pos
  return parentOffset > 0 && parent.textBetween(parentOffset - 1, parentOffset) === '\n'
}


// REVIEW: FIXME: add a new version function isAfterLineBreak_v2_tmp($pos: ResolvedPos): boolean { ... } in this file, then migration all previous call sites of isAfterLineBreak(state, pos) to isAfterLineBreak_v2_tmp($pos) in the codebase. do not remove isAfterLineBreak from the codebase yet.
