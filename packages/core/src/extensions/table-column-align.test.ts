import type { EditorNode } from '@prosekit/pm/model'
import { describe, expect, it } from 'vitest'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture } from '../testing/index.ts'

import {
  getTableColumnAlign,
  type MeowdownTableCellAttrs,
  type TableColumnAlign,
} from './table-column-align.ts'

type Builders = ReturnType<typeof setupFixture>['n']

/** An unaligned table with the caret in the first data cell. */
function plainTable(n: Builders): EditorNode {
  return n.doc(
    n.table(
      n.tableRow(n.tableHeaderCell(n.paragraph('a')), n.tableHeaderCell(n.paragraph('b'))),
      n.tableRow(n.tableCell(n.paragraph('<a>1')), n.tableCell(n.paragraph('2'))),
    ),
  )
}

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

function getCellHitPositions(doc: EditorNode): number[] {
  const positions: number[] = []
  doc.descendants((node, pos) => {
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeaderCell') {
      positions.push(pos + 1)
      return false
    }
    return true
  })
  return positions
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

describe('setTableColumnAlign', () => {
  it('aligns the column at the caret', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(plainTable(n))

    editor.commands.setTableColumnAlign('center')

    expect(getCellAligns(fixture.doc)).toEqual([
      ['center', null],
      ['center', null],
    ])
    expect(docToMarkdown(fixture.doc)).toBe('| a | b |\n| :-: | --- |\n| 1 | 2 |\n')
  })

  it('aligns every column a cell selection touches', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(plainTable(n))

    const [headerA, headerB] = getCellHitPositions(fixture.doc)
    editor.commands.selectTableRow({ anchor: headerA, head: headerB })
    editor.commands.setTableColumnAlign('right')

    expect(getCellAligns(fixture.doc)).toEqual([
      ['right', 'right'],
      ['right', 'right'],
    ])
  })

  it('clears alignment with null', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(alignedTable(n))

    editor.commands.setTableColumnAlign(null)

    expect(getCellAligns(fixture.doc)).toEqual([
      [null, null],
      [null, null],
    ])
    expect(docToMarkdown(fixture.doc)).toBe('| a | b |\n| --- | --- |\n| 1 | 2 |\n')
  })

  it('cannot exec outside a table', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('<a>outside')))

    expect(editor.commands.setTableColumnAlign.canExec('left')).toBe(false)
  })

  it('undoes the alignment and its sync in one step', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(plainTable(n))

    editor.commands.setTableColumnAlign('center')
    editor.commands.undo()

    expect(getCellAligns(fixture.doc)).toEqual([
      [null, null],
      [null, null],
    ])
  })
})

describe('getTableColumnAlign', () => {
  it('reads the alignment of the caret column', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(alignedTable(n))

    expect(getTableColumnAlign(editor.state)).toBe('center')
  })

  it('returns undefined for an unaligned column', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(plainTable(n))

    expect(getTableColumnAlign(editor.state)).toBeUndefined()
  })

  it('returns undefined outside a table', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('<a>outside')))

    expect(getTableColumnAlign(editor.state)).toBeUndefined()
  })
})
