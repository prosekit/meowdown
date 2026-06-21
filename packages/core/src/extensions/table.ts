import { defineKeymap, Priority, union, withPriority, type PlainExtension } from '@prosekit/core'
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
import type { Command } from '@prosekit/pm/state'

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
    defineTableEditingPlugin({ allowTableNodeSelection: true }),
    defineTableCommands(),
    defineTableDropIndicator(),
    defineTableKeymap(),
  )
}
