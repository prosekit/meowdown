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
})

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
