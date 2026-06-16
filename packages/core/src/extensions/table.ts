import { union } from '@prosekit/core'
import {
  defineTableCellSpec,
  defineTableCommands,
  defineTableDropIndicator,
  defineTableEditingPlugin,
  defineTableHeaderCellSpec,
  defineTableRowSpec,
  defineTableSpec,
} from '@prosekit/extensions/table'

export function defineTable() {
  return union(
    defineTableSpec(),
    defineTableRowSpec(),
    defineTableCellSpec(),
    defineTableHeaderCellSpec(),
    defineTableEditingPlugin({ allowTableNodeSelection: true }),
    defineTableCommands(),
    defineTableDropIndicator(),
  )
}
