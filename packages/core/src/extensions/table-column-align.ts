import { defineNodeAttr, union, type Extension, type Union } from '@prosekit/core'

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

export type TableColumnAlignExtension = Union<
  [TableCellAlignExtension, TableHeaderCellAlignExtension]
>

export function defineTableColumnAlign(): TableColumnAlignExtension {
  return union(defineTableCellAlignAttr(), defineTableHeaderCellAlignAttr())
}
