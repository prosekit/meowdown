import { defaultBlockAt, defineKeymap, type PlainExtension } from '@prosekit/core'
import type { ProseMirrorNode } from '@prosekit/pm/model'
import { TextSelection, type Command, type Transaction } from '@prosekit/pm/state'

import { isNodeOfType } from './node-names.ts'

/**
 * The parent's default block at `position`, when that parent can hold it.
 */
function defaultBlockAtPosition(doc: ProseMirrorNode, position: number): ProseMirrorNode | null {
  const $position = doc.resolve(position)
  const parent = $position.parent
  const index = $position.index()
  const type = defaultBlockAt(parent.contentMatchAt(index))
  const block = type?.createAndFill()
  if (!type || !block || !parent.canReplaceWith(index, index, type)) return null
  return block
}

/**
 * Insert the parent's default block at `position` and place the caret inside
 * it. Shared by leaving a code block and by `insertMarkdown`'s `after-block`
 * selection, so both create that block the same way.
 */
export function insertDefaultBlockAt(transaction: Transaction, position: number): boolean {
  const block = defaultBlockAtPosition(transaction.doc, position)
  if (!block) return false
  transaction.insert(position, block)
  transaction.setSelection(TextSelection.create(transaction.doc, position + 1))
  return true
}

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

  if (!dispatch) return defaultBlockAtPosition(state.doc, after) !== null
  const transaction = state.tr
  if (!insertDefaultBlockAt(transaction, after)) return false
  dispatch(transaction.scrollIntoView())
  return true
}

export function defineCodeBlockExitKeymap(): PlainExtension {
  return defineKeymap({ 'Mod-Enter': exitCodeBlockAtEnd })
}
