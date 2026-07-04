import type { EditorNode } from '@prosekit/pm/model'
import { describe, expect, it } from 'vitest'

import { setupFixture } from '../testing/index.ts'

import type { MeowdownTableCellAttrs, TableColumnAlign } from './table-column-align.ts'

type Builders = ReturnType<typeof setupFixture>['n']

/** A table whose first column is centered, with the caret in the first data cell. */
function alignedTable(n: Builders): EditorNode {
  return n.doc(
    n.table(
      n.tableRow(
        n.tableHeaderCell({ align: 'center' }, n.paragraph('a')),
        n.tableHeaderCell(n.paragraph('b')),
      ),
      n.tableRow(
        n.tableCell({ align: 'center' }, n.paragraph('<a>1')),
        n.tableCell(n.paragraph('2')),
      ),
    ),
  )
}

function getCellAligns(doc: EditorNode): Array<Array<TableColumnAlign | null>> {
  const rows: Array<Array<TableColumnAlign | null>> = []
  doc.descendants((node) => {
    if (node.type.name !== 'tableRow') return true
    const cells: Array<TableColumnAlign | null> = []
    node.forEach((cell) => {
      cells.push((cell.attrs as MeowdownTableCellAttrs).align ?? null)
    })
    rows.push(cells)
    return false
  })
  return rows
}

function getFirstDataCellPos(doc: EditorNode): number {
  let found = -1
  doc.descendants((node, pos) => {
    if (found >= 0) return false
    if (node.type.name === 'tableCell') {
      found = pos
      return false
    }
    return true
  })
  return found
}

describe('table align sync', () => {
  it('inherits column alignment when a row is inserted', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(alignedTable(n))

    editor.commands.addTableRowBelow()

    expect(getCellAligns(fixture.doc)).toEqual([
      ['center', null],
      ['center', null],
      ['center', null],
    ])
  })

  it('leaves an inserted column unaligned', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(alignedTable(n))

    editor.commands.addTableColumnAfter()

    expect(getCellAligns(fixture.doc)).toEqual([
      ['center', null, null],
      ['center', null, null],
    ])
  })

  it('restores a data cell align that drifts from the alignment row', () => {
    using fixture = setupFixture()
    const { n, view } = fixture
    fixture.set(alignedTable(n))

    const cellPos = getFirstDataCellPos(view.state.doc)
    const cell = view.state.doc.nodeAt(cellPos)
    if (cell == null) throw new Error('missing data cell')
    view.dispatch(
      view.state.tr.setNodeMarkup(cellPos, undefined, { ...cell.attrs, align: 'right' }),
    )

    expect(getCellAligns(fixture.doc)).toEqual([
      ['center', null],
      ['center', null],
    ])
  })
})
