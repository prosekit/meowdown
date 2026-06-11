import { definePlugin, union } from '@prosekit/core'
import {
  defineTableCellSpec,
  defineTableCommands,
  defineTableDropIndicator,
  defineTableHeaderCellSpec,
  defineTableRowSpec,
  defineTableSpec,
} from '@prosekit/extensions/table'
import { tableEditing } from 'prosemirror-tables'

export function defineTable() {
  return union(
    defineTableSpec(),
    defineTableRowSpec(),
    defineTableCellSpec(),
    defineTableHeaderCellSpec(),
    definePlugin(tableEditing()), // TODO: export related API from prosekit so that we don't have to install prosemirror-tables as a separate dependency
    defineTableCommands(),
    defineTableDropIndicator(),
  )
}
