import { defaultBlockAt, defineKeymap, type PlainExtension } from '@prosekit/core'
import { TextSelection, type Command } from '@prosekit/pm/state'

import { isNodeOfType } from './node-names.ts'

/**
 * With the caret at the end of a code block, move it into the block below when
 * that block is an empty paragraph, and into a new default block otherwise.
 */
export const exitCodeBlockAtEnd: Command = (state, dispatch) => {
  const { $head, empty } = state.selection
  if (!empty) {
    return false
  }

  const codeBlock = $head.parent
  if (!codeBlock.type.spec.code || $head.parentOffset !== codeBlock.content.size) {
    return false
  }

  const container = $head.node(-1)
  const indexAfter = $head.indexAfter(-1)
  const after = $head.after()
  const next = container.maybeChild(indexAfter)
  if (next && isNodeOfType(next, 'paragraph') && next.content.size === 0) {
    dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, after + 1)).scrollIntoView())
    return true
  }

  const type = defaultBlockAt(container.contentMatchAt(indexAfter))
  const block = type?.createAndFill()
  if (!type || !block || !container.canReplaceWith(indexAfter, indexAfter, type)) {
    return false
  }
  if (dispatch) {
    const tr = state.tr.insert(after, block)
    dispatch(tr.setSelection(TextSelection.create(tr.doc, after + 1)).scrollIntoView())
  }
  return true
}

export function defineCodeBlockExitKeymap(): PlainExtension {
  return defineKeymap({ 'Mod-Enter': exitCodeBlockAtEnd })
}
