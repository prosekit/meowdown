import {
  defineKeymap,
  defineNodeSpec,
  Priority,
  union,
  withPriority,
  type PlainExtension,
} from '@prosekit/core'
import {
  defineTableCellSpec,
  defineTableCommands,
  defineTableDropIndicator,
  defineTableEditingPlugin,
  defineTableHeaderCellSpec,
  defineTableRowSpec,
  defineTableSpec,
  deleteTable,
  isCellSelection,
} from '@prosekit/extensions/table'
import type { Command, EditorState } from '@prosekit/pm/state'

import type { NodeName } from './node-names.ts'
import { defineTableColumnAlign } from './table-column-align.ts'

/**
 * Whether the selection sits inside a table cell (data or header). Useful for
 * gating block-creating UI, since cells hold inline content only.
 */
export function isSelectionInTableCell(state: EditorState): boolean {
  const { $from } = state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    const name = $from.node(depth).type.name
    if (
      name === ('tableCell' satisfies NodeName) ||
      name === ('tableHeaderCell' satisfies NodeName)
    ) {
      return true
    }
  }
  return false
}

// GFM table cells are inline-only. ProseKit's cell spec defaults to `block+`,
// which lets a cell nest lists, blockquotes, headings, and so on. Override the
// content to a single paragraph so a cell can never hold another block.
// `defineNodeSpec` merges specs of the same name, so this keeps ProseKit's cell
// attrs and DOM and only swaps the content expression.
const CELL_CONTENT = 'paragraph' satisfies NodeName

function defineTableCellContent() {
  return union(
    defineNodeSpec({ name: 'tableCell' satisfies NodeName, content: CELL_CONTENT }),
    defineNodeSpec({ name: 'tableHeaderCell' satisfies NodeName, content: CELL_CONTENT }),
  )
}

// When a cell selection covers the whole table, Backspace and Delete remove the
// entire table instead of only clearing the cell contents.
const deleteTableOnFullCellSelection: Command = (state, dispatch) => {
  const { selection } = state
  if (!isCellSelection(selection)) return false
  if (!selection.isColSelection() || !selection.isRowSelection()) return false
  return deleteTable(state, dispatch)
}

function defineTableKeymap(): PlainExtension {
  return withPriority(
    defineKeymap({
      Backspace: deleteTableOnFullCellSelection,
      Delete: deleteTableOnFullCellSelection,
    }),
    Priority.high,
  )
}

export function defineTable() {
  return union(
    defineTableSpec(),
    defineTableRowSpec(),
    defineTableCellSpec(),
    defineTableHeaderCellSpec(),
    defineTableCellContent(),
    defineTableColumnAlign(),
    defineTableEditingPlugin({ allowTableNodeSelection: true }),
    defineTableCommands(),
    defineTableDropIndicator(),
    defineTableKeymap(),
  )
}
