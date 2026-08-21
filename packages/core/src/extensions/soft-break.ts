import { defineCommands, defineKeymap, union } from '@prosekit/core'
import { chainCommands, newlineInCode, splitBlock } from '@prosekit/pm/commands'
import type { ResolvedPos } from '@prosekit/pm/model'
import type { Command, Transaction } from '@prosekit/pm/state'
import { enterCommand } from 'prosemirror-flat-list'

import { isAfterLineBreak } from '../utils/is-after-line-break.ts'

import { isNodeOfType } from './node-names.ts'

// Only a paragraph can hold a soft break. A heading ends where its line does
// (only a parsed setext heading spans one), and a table cell serializes as a
// single row line, so the cell writer folds a newline into a space.
function canHoldSoftBreak($pos: ResolvedPos): boolean {
  if (!isNodeOfType($pos.parent, 'paragraph')) return false
  // A table cell holds exactly one paragraph, so the cell is the paragraph's
  // direct parent whenever the caret sits in one.
  const container = $pos.depth > 0 ? $pos.node($pos.depth - 1) : undefined
  if (container == null) return true
  return !isNodeOfType(container, 'tableCell') && !isNodeOfType(container, 'tableHeaderCell')
}

// What Enter does at a caret `splitPendingSoftBreak` admits. The rest of the
// editor's Enter chain cannot fire there: `newlineInCode` needs a code block,
// `createParagraphNear` a parent that is not inline content, `liftEmptyBlock` an
// empty one, and a `\n` always sits in front of the caret, so the paragraph is
// neither.
const splitBlockOnEnter = chainCommands(enterCommand, splitBlock)

// A caret already sitting after a soft break: markdown cannot hold a blank line
// inside a paragraph, so make the block split now instead of leaving a break
// that becomes one on the next load. Split first, then drop the `\n` the split
// left at the end of the first block.
const splitPendingSoftBreak: Command = (state, dispatch, view) => {
  const { $from, empty } = state.selection
  if (!empty || !canHoldSoftBreak($from)) return false
  if (!isAfterLineBreak(state, $from.pos)) return false
  let split: Transaction | undefined
  const handled = splitBlockOnEnter(
    state,
    (candidate) => {
      split = candidate
    },
    view,
  )
  if (!handled || split == null) return false
  if (dispatch == null) return true
  const from = split.mapping.map($from.pos - 1, -1)
  const to = split.mapping.map($from.pos, -1)
  dispatch(split.delete(from, to).scrollIntoView())
  return true
}

const insertSoftBreakText: Command = (state, dispatch) => {
  if (!canHoldSoftBreak(state.selection.$from)) return false
  dispatch?.(state.tr.insertText('\n').scrollIntoView())
  return true
}

const softBreakCommand = chainCommands(newlineInCode, splitPendingSoftBreak, insertSoftBreakText)

/**
 * Insert a markdown soft line break at the caret: a literal `\n` in the
 * paragraph's text. In a code block it writes the newline plain Enter writes
 * there. On a caret that already sits right after a soft break it splits the
 * block instead, because a paragraph cannot hold a blank line.
 */
function insertSoftBreak(): Command {
  return softBreakCommand
}

export function defineSoftBreak() {
  return union(
    defineCommands({ insertSoftBreak }),
    defineKeymap({ 'Shift-Enter': softBreakCommand }),
  )
}
