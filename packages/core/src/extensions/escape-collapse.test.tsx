import { NodeSelection } from '@prosekit/pm/state'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { setupFixture } from '../testing/index.ts'

describe('defineEscapeCollapse', () => {
  it('collapses a text selection to a caret at its head', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('he<a>ll<b>o')))
    fixture.view.focus()
    await userEvent.keyboard('{Escape}')
    expect(fixture.state.selection.empty).toBe(true)
    expect(fixture.selectionSnapshot).toBe('hell┃o')
  })

  it('collapses a backwards selection to its head', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('he<b>ll<a>o')))
    fixture.view.focus()
    await userEvent.keyboard('{Escape}')
    expect(fixture.selectionSnapshot).toBe('he┃llo')
  })

  it('leaves an empty selection alone', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('he<a>llo')))
    fixture.view.focus()
    await userEvent.keyboard('{Escape}')
    expect(fixture.selectionSnapshot).toBe('he┃llo')
  })

  it('collapses a node selection to a caret', async () => {
    using fixture = setupFixture()
    const { n, view } = fixture
    fixture.set(n.doc(n.paragraph('before'), n.horizontalRule(), n.paragraph('after')))
    const hrPos = view.state.doc.child(0).nodeSize
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, hrPos)))
    view.focus()
    expect(fixture.state.selection.empty).toBe(false)
    await userEvent.keyboard('{Escape}')
    expect(fixture.state.selection.empty).toBe(true)
  })
})
