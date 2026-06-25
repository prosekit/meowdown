import { NodeSelection } from '@prosekit/pm/state'
import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'

import { setupFixture, type Fixture } from '../testing/index.ts'

import { defineExitBoundaryHandler, type ExitBoundaryHandler } from './exit-boundary.ts'

function setup(onExitBoundary: ExitBoundaryHandler): Fixture {
  const fixture = setupFixture()
  fixture.editor.use(defineExitBoundaryHandler(onExitBoundary))
  return fixture
}

// A block node that can be wrapped in a NodeSelection.
function makeTable(n: Fixture['n']) {
  return n.table(
    n.tableRow(n.tableHeaderCell(n.paragraph('a')), n.tableHeaderCell(n.paragraph('b'))),
    n.tableRow(n.tableCell(n.paragraph('1')), n.tableCell(n.paragraph('2'))),
  )
}

describe('defineExitBoundaryHandler', () => {
  it('fires "up" when ArrowUp is pressed at the document top', async () => {
    const onExitBoundary = vi.fn<ExitBoundaryHandler>()
    using fixture = setup(onExitBoundary)
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>hello'), n.paragraph('world')))
    fixture.view.focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(onExitBoundary).toHaveBeenCalledTimes(1)
    expect(onExitBoundary.mock.calls[0][0]).toMatchObject({ direction: 'up' })
    expect(onExitBoundary.mock.calls[0][0].event).toBeInstanceOf(KeyboardEvent)
  })

  it('fires "down" when ArrowDown is pressed at the document bottom', async () => {
    const onExitBoundary = vi.fn<ExitBoundaryHandler>()
    using fixture = setup(onExitBoundary)
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('hello'), n.paragraph('world<a>')))
    fixture.view.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(onExitBoundary).toHaveBeenCalledTimes(1)
    expect(onExitBoundary.mock.calls[0][0]).toMatchObject({ direction: 'down' })
  })

  it('does not fire ArrowUp when a block sits above the cursor', async () => {
    const onExitBoundary = vi.fn<ExitBoundaryHandler>()
    using fixture = setup(onExitBoundary)
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('hello'), n.paragraph('<a>world')))
    fixture.view.focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(onExitBoundary).not.toHaveBeenCalled()
  })

  it('does not fire ArrowDown when a block sits below the cursor', async () => {
    const onExitBoundary = vi.fn<ExitBoundaryHandler>()
    using fixture = setup(onExitBoundary)
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>hello'), n.paragraph('world')))
    fixture.view.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(onExitBoundary).not.toHaveBeenCalled()
  })

  it('uses the visual line, not the caret position: ArrowUp fires from the first wrapped line', async () => {
    const onExitBoundary = vi.fn<ExitBoundaryHandler>()
    using fixture = setup(onExitBoundary)
    const { n } = fixture
    const filler = 'lorem ipsum '.repeat(300)
    // Caret a few chars in: still the first visual line, but its pos is not 1.
    fixture.set(n.doc(n.paragraph(`lo<a>rem ${filler}`)))
    fixture.view.focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(onExitBoundary).toHaveBeenCalledWith(expect.objectContaining({ direction: 'up' }))
  })

  it('does not fire ArrowUp from a lower visual line of the first paragraph', async () => {
    const onExitBoundary = vi.fn<ExitBoundaryHandler>()
    using fixture = setup(onExitBoundary)
    const { n } = fixture
    const filler = 'lorem ipsum '.repeat(300)
    // Caret at the very end: the last visual line of the wrapped paragraph.
    fixture.set(n.doc(n.paragraph(`${filler}end<a>`)))
    fixture.view.focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(onExitBoundary).not.toHaveBeenCalled()
  })

  it('fires "up" for a NodeSelection at the document top', async () => {
    const onExitBoundary = vi.fn<ExitBoundaryHandler>()
    using fixture = setup(onExitBoundary)
    const { n, view } = fixture
    fixture.set(n.doc(makeTable(n), n.paragraph('after')))
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)))
    view.focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(onExitBoundary).toHaveBeenCalledWith(expect.objectContaining({ direction: 'up' }))
  })

  it('does not fire "down" for a NodeSelection with content below', async () => {
    const onExitBoundary = vi.fn<ExitBoundaryHandler>()
    using fixture = setup(onExitBoundary)
    const { n, view } = fixture
    fixture.set(n.doc(makeTable(n), n.paragraph('after')))
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)))
    view.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(onExitBoundary).not.toHaveBeenCalled()
  })

  it('does not fire for a non-empty text selection', async () => {
    const onExitBoundary = vi.fn<ExitBoundaryHandler>()
    using fixture = setup(onExitBoundary)
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>hello<b>'), n.paragraph('world')))
    fixture.view.focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(onExitBoundary).not.toHaveBeenCalled()
  })

  it('does not fire when a modifier (Shift) is held', async () => {
    const onExitBoundary = vi.fn<ExitBoundaryHandler>()
    using fixture = setup(onExitBoundary)
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>hello')))
    fixture.view.focus()
    await userEvent.keyboard('{Shift>}{ArrowUp}{/Shift}')
    expect(onExitBoundary).not.toHaveBeenCalled()
  })

  it('fires both directions in an empty document', async () => {
    const onExitBoundary = vi.fn<ExitBoundaryHandler>()
    using fixture = setup(onExitBoundary)
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))
    fixture.view.focus()
    await userEvent.keyboard('{ArrowUp}')
    await userEvent.keyboard('{ArrowDown}')
    expect(onExitBoundary.mock.calls.map((call) => call[0].direction)).toEqual(['up', 'down'])
  })
})
