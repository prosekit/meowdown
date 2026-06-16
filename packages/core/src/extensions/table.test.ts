import { NodeSelection } from '@prosekit/pm/state'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture } from '../testing/index.ts'

describe('table block-handle deletion', () => {
  it('deletes the whole table when Backspace follows a block-handle node-selection', async () => {
    using fixture = setupFixture()
    const { n, view } = fixture
    fixture.set(
      n.doc(
        n.paragraph('before'),
        n.table(
          n.tableRow(n.tableHeaderCell(n.paragraph('a')), n.tableHeaderCell(n.paragraph('b'))),
          n.tableRow(n.tableCell(n.paragraph('1')), n.tableCell(n.paragraph('2'))),
        ),
      ),
    )

    // Reproduce what the block handle does: node-select the table node.
    let tablePos = -1
    fixture.doc.forEach((node, offset) => {
      if (node.type.name === 'table') tablePos = offset
    })
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, tablePos)))

    view.focus()
    await userEvent.keyboard('{Backspace}')

    // The whole table is gone: no pipe characters remain.
    expect(docToMarkdown(fixture.doc).includes('|')).toBe(false)
  })
})
