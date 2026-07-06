import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'

import { setupFixture, type Fixture } from '../testing/index.ts'

import { defineExitBoundaryHandler, type ExitBoundaryHandler } from './exit-boundary.ts'

function setup(): Fixture {
  return setupFixture({ extensionOptions: { markMode: 'hide' } })
}

describe('Meta-ArrowUp / Meta-ArrowDown', () => {
  it('moves the caret to the document start when the document begins with a task list', async () => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(
      n.doc(
        n.list({ kind: 'task', checked: false }, n.paragraph('todo one')),
        n.list({ kind: 'task', checked: false }, n.paragraph('todo two')),
        n.paragraph('tail<a>'),
      ),
    )
    fixture.view.focus()
    await userEvent.keyboard('{Meta>}{ArrowUp}{/Meta}')
    const selection = fixture.state.selection
    expect(selection.empty).toBe(true)
    expect(selection.$head.parent.textContent).toBe('todo one')
    expect(selection.$head.parentOffset).toBe(0)
  })

  it('moves the caret to the document start when the document begins with a bullet list', async () => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(
      n.doc(
        n.list({ kind: 'bullet' }, n.paragraph('bullet one')),
        n.paragraph('middle'),
        n.paragraph('tail<a>'),
      ),
    )
    fixture.view.focus()
    await userEvent.keyboard('{Meta>}{ArrowUp}{/Meta}')
    const selection = fixture.state.selection
    expect(selection.empty).toBe(true)
    expect(selection.$head.parent.textContent).toBe('bullet one')
    expect(selection.$head.parentOffset).toBe(0)
  })

  it('moves the caret to the document start in a plain paragraph document, even right after focus', async () => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('alpha'), n.paragraph('beta<a>')))
    fixture.view.focus()
    await userEvent.keyboard('{Meta>}{ArrowUp}{/Meta}')
    const selection = fixture.state.selection
    expect(selection.empty).toBe(true)
    expect(selection.head).toBe(1)
  })

  it('rests before a hidden run when the document starts with one', async () => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('**bold** first'), n.paragraph('tail<a>')))
    fixture.view.focus()
    await userEvent.keyboard('{Meta>}{ArrowUp}{/Meta}')
    const selection = fixture.state.selection
    expect(selection.empty).toBe(true)
    expect(selection.head).toBe(1)
  })

  it('moves the caret to the document end when the document ends with a task list', async () => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(
      n.doc(
        n.paragraph('<a>alpha'),
        n.list({ kind: 'task', checked: false }, n.paragraph('todo one')),
        n.list({ kind: 'task', checked: false }, n.paragraph('todo two')),
      ),
    )
    fixture.view.focus()
    await userEvent.keyboard('{Meta>}{ArrowDown}{/Meta}')
    const selection = fixture.state.selection
    expect(selection.empty).toBe(true)
    expect(selection.$head.parent.textContent).toBe('todo two')
    expect(selection.$head.parentOffset).toBe(selection.$head.parent.content.size)
  })

  it('extends the selection to the document start on Shift-Meta-ArrowUp', async () => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('alpha'), n.paragraph('beta<a>')))
    fixture.view.focus()
    const anchor = fixture.state.selection.anchor
    await userEvent.keyboard('{Shift>}{Meta>}{ArrowUp}{/Meta}{/Shift}')
    const selection = fixture.state.selection
    expect(selection.anchor).toBe(anchor)
    expect(selection.head).toBe(1)
  })

  it('extends the selection to the document end on Shift-Meta-ArrowDown', async () => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>alpha'), n.paragraph('beta')))
    fixture.view.focus()
    const anchor = fixture.state.selection.anchor
    await userEvent.keyboard('{Shift>}{Meta>}{ArrowDown}{/Meta}{/Shift}')
    const selection = fixture.state.selection
    expect(selection.anchor).toBe(anchor)
    expect(selection.head).toBe(fixture.doc.content.size - 1)
  })

  it('does not fire the exit-boundary handler from the document start', async () => {
    const onExitBoundary = vi.fn<ExitBoundaryHandler>()
    using fixture = setup()
    fixture.editor.use(defineExitBoundaryHandler(onExitBoundary))
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>alpha'), n.paragraph('beta')))
    fixture.view.focus()
    await userEvent.keyboard('{Meta>}{ArrowUp}{/Meta}')
    expect(onExitBoundary).not.toHaveBeenCalled()
    expect(fixture.state.selection.head).toBe(1)
  })
})
