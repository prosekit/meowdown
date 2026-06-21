import type { EditorNode } from '@prosekit/pm/model'
import { NodeSelection } from '@prosekit/pm/state'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { setupFixture } from '../testing/index.ts'

describe('table', () => {
  it('deletes the whole selected table when Backspace', async () => {
    using fixture = setupFixture()
    const { n, view } = fixture
    const doc = n.doc(
      n.paragraph('before'),
      n.table(
        n.tableRow(n.tableHeaderCell(n.paragraph('a')), n.tableHeaderCell(n.paragraph('b'))),
        n.tableRow(n.tableCell(n.paragraph('1')), n.tableCell(n.paragraph('2'))),
      ),
    )
    fixture.set(doc)

    const tablePos = getTablePos(fixture.doc)
    const selection = NodeSelection.create(view.state.doc, tablePos)
    view.dispatch(view.state.tr.setSelection(selection))

    view.focus()
    expect(hasTable(fixture.doc)).toBe(true)
    await userEvent.keyboard('{Backspace}')
    expect(hasTable(fixture.doc)).toBe(false)
  })

  it('clears only the selected cells when Backspace over a partial cell selection', async () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    const doc = n.doc(
      n.paragraph('before'),
      n.table(
        n.tableRow(n.tableHeaderCell(n.paragraph('a')), n.tableHeaderCell(n.paragraph('b'))),
        n.tableRow(n.tableCell(n.paragraph('1')), n.tableCell(n.paragraph('2'))),
      ),
    )
    fixture.set(doc)

    const [headerA, headerB] = cellHitPositions(fixture.doc)
    editor.commands.selectTableRow({ anchor: headerA, head: headerB })

    view.focus()
    await userEvent.keyboard('{Backspace}')

    expect(hasTable(fixture.doc)).toBe(true)
    expect(cellTexts(fixture.doc)).toEqual(['', '', '1', '2'])
  })

  it('deletes the whole table when Backspace over a full cell selection', async () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    const doc = n.doc(
      n.paragraph('before'),
      n.table(
        n.tableRow(n.tableHeaderCell(n.paragraph('a')), n.tableHeaderCell(n.paragraph('b'))),
        n.tableRow(n.tableCell(n.paragraph('1')), n.tableCell(n.paragraph('2'))),
      ),
    )
    fixture.set(doc)

    const [headerA] = cellHitPositions(fixture.doc)
    editor.commands.selectTable({ pos: headerA })

    view.focus()
    expect(hasTable(fixture.doc)).toBe(true)
    await userEvent.keyboard('{Backspace}')
    expect(hasTable(fixture.doc)).toBe(false)
  })
})

function cellTexts(doc: EditorNode): string[] {
  const texts: string[] = []
  doc.descendants((node) => {
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeaderCell') {
      texts.push(node.textContent)
      return false
    }
    return true
  })
  return texts
}

function cellHitPositions(doc: EditorNode): number[] {
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

function hasTable(doc: EditorNode): boolean {
  return getTablePos(doc) > -1
}

function getTablePos(doc: EditorNode): number {
  let tablePos = -1
  doc.forEach((node, offset) => {
    if (node.type.name === 'table') tablePos = offset
  })
  return tablePos
}
