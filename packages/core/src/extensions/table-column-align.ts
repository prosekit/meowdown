import {
  defineNodeAttr,
  definePlugin,
  union,
  type Extension,
  type PlainExtension,
  type Union,
} from '@prosekit/core'
import type { ProseMirrorNode } from '@prosekit/pm/model'
import { Plugin, PluginKey, type Transaction } from '@prosekit/pm/state'

import type { NodeName } from './node-names.ts'

/**
 * Column alignment of a GFM table, encoded by the delimiter row: `:--` for
 * left, `:-:` for center, `--:` for right.
 */
export type TableColumnAlign = 'left' | 'center' | 'right'

export interface MeowdownTableCellAttrs {
  /**
   * The column alignment this cell renders with. Defaults to null, which
   * renders with the default left alignment and serializes the delimiter
   * column as `---`.
   */
  align?: TableColumnAlign | null
}

type TableCellAlignExtension = Extension<{
  Nodes: { tableCell: MeowdownTableCellAttrs }
}>

type TableHeaderCellAlignExtension = Extension<{
  Nodes: { tableHeaderCell: MeowdownTableCellAttrs }
}>

export function parseTableColumnAlign(value: string | null): TableColumnAlign | null {
  return value === 'left' || value === 'center' || value === 'right' ? value : null
}

function defineTableCellAlignAttr(): TableCellAlignExtension {
  return defineNodeAttr<'tableCell', 'align', TableColumnAlign | null>({
    type: 'tableCell' satisfies NodeName,
    attr: 'align',
    default: null,
    toDOM: (value) => (value ? ['data-align', value] : null),
    parseDOM: (node) => parseTableColumnAlign(node.getAttribute('data-align')),
  })
}

function defineTableHeaderCellAlignAttr(): TableHeaderCellAlignExtension {
  return defineNodeAttr<'tableHeaderCell', 'align', TableColumnAlign | null>({
    type: 'tableHeaderCell' satisfies NodeName,
    attr: 'align',
    default: null,
    toDOM: (value) => (value ? ['data-align', value] : null),
    parseDOM: (node) => parseTableColumnAlign(node.getAttribute('data-align')),
  })
}

/**
 * The row whose `align` attrs define the column alignment of the whole table:
 * the header row, or the first row of a headerless table. Matches the row the
 * serializer reads when it writes the delimiter row.
 */
function findAlignmentRow(table: ProseMirrorNode): ProseMirrorNode {
  for (let rowIndex = 0; rowIndex < table.childCount; rowIndex++) {
    const row = table.child(rowIndex)
    for (let column = 0; column < row.childCount; column++) {
      if (row.child(column).type.name === ('tableHeaderCell' satisfies NodeName)) return row
    }
  }
  return table.child(0)
}

function getCellAlign(row: ProseMirrorNode, column: number): TableColumnAlign | null {
  if (column >= row.childCount) return null
  return (row.child(column).attrs as MeowdownTableCellAttrs).align ?? null
}

function syncTableAligns(table: ProseMirrorNode, tablePos: number, tr: Transaction): void {
  if (table.childCount === 0) return
  const alignmentRow = findAlignmentRow(table)
  let rowPos = tablePos + 1
  for (let rowIndex = 0; rowIndex < table.childCount; rowIndex++) {
    const row = table.child(rowIndex)
    let cellPos = rowPos + 1
    for (let column = 0; column < row.childCount; column++) {
      const cell = row.child(column)
      const align = getCellAlign(alignmentRow, column)
      if (((cell.attrs as MeowdownTableCellAttrs).align ?? null) !== align) {
        // `setNodeMarkup` keeps node sizes, so positions computed up front
        // stay valid across fixes.
        tr.setNodeMarkup(cellPos, undefined, { ...cell.attrs, align })
      }
      cellPos += cell.nodeSize
    }
    rowPos += row.nodeSize
  }
}

/**
 * The union of changed ranges across `transactions`, in the coordinates of the
 * final document.
 */
function unionOfChangedRanges(
  transactions: readonly Transaction[],
): { from: number; to: number } | undefined {
  let from: number | undefined
  let to: number | undefined
  for (const transaction of transactions) {
    if (!transaction.docChanged) continue
    if (from != null && to != null) {
      from = transaction.mapping.map(from, -1)
      to = transaction.mapping.map(to, 1)
    }
    const mapping = transaction.mapping
    for (const [index, stepMap] of mapping.maps.entries()) {
      const remaining = mapping.slice(index + 1)
      stepMap.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
        const start = remaining.map(newStart, -1)
        const end = remaining.map(newEnd, 1)
        from = from == null ? start : Math.min(from, start)
        to = to == null ? end : Math.max(to, end)
      })
    }
  }
  if (from == null || to == null) return undefined
  return { from, to }
}

// Rendering needs the `align` attr on every cell, but the alignment row is
// the semantic source (GFM alignment is a column property). Copy it to the
// data cells after every doc change, so inserted rows and pasted cells
// inherit their column's alignment.
function createTableAlignSyncPlugin(): Plugin {
  return new Plugin({
    key: new PluginKey('table-align-sync'),
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some((transaction) => transaction.docChanged)) return
      const range = unionOfChangedRanges(transactions)
      if (!range) return
      const doc = newState.doc
      const from = Math.max(0, Math.min(range.from, doc.content.size))
      const to = Math.max(from, Math.min(range.to, doc.content.size))
      let tr: Transaction | undefined
      doc.nodesBetween(from, to, (node, pos) => {
        if (node.type.name !== ('table' satisfies NodeName)) return true
        tr ??= newState.tr
        syncTableAligns(node, pos, tr)
        return false
      })
      return tr?.docChanged ? tr : undefined
    },
  })
}

function defineTableAlignSync(): PlainExtension {
  return definePlugin(createTableAlignSyncPlugin())
}

export type TableColumnAlignExtension = Union<
  [TableCellAlignExtension, TableHeaderCellAlignExtension, PlainExtension]
>

export function defineTableColumnAlign(): TableColumnAlignExtension {
  return union(defineTableCellAlignAttr(), defineTableHeaderCellAlignAttr(), defineTableAlignSync())
}
