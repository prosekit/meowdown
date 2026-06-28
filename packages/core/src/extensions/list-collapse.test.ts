import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { setCaret, setupFixture } from '../testing/index.ts'

const pmRoot = page.locate('.ProseMirror')

describe('toggleListCollapsed', () => {
  it('folds and unfolds a bullet that has children', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(
      n.doc(
        n.list(
          { kind: 'bullet' },
          n.paragraph('parent'),
          n.list({ kind: 'bullet' }, n.paragraph('child')),
        ),
      ),
    )
    setCaret(fixture, 2)

    expect(editor.commands.toggleListCollapsed.canExec()).toBe(true)
    editor.commands.toggleListCollapsed()
    expect(fixture.doc.child(0).attrs.collapsed).toBe(true)
    editor.commands.toggleListCollapsed()
    expect(fixture.doc.child(0).attrs.collapsed).toBe(false)
  })

  it('cannot fold a leaf bullet', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.list({ kind: 'bullet' }, n.paragraph('leaf'))))
    setCaret(fixture, 2)
    expect(editor.commands.toggleListCollapsed.canExec()).toBe(false)
  })

  it('does not fold a task', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(
      n.doc(
        n.list({ kind: 'task' }, n.paragraph('a'), n.list({ kind: 'bullet' }, n.paragraph('b'))),
      ),
    )
    setCaret(fixture, 2)
    expect(editor.commands.toggleListCollapsed.canExec()).toBe(false)
  })
})

describe('bullet fold rendering', () => {
  it('hides descendants when collapsed and shows them when expanded', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(
      n.doc(
        n.list(
          { kind: 'bullet', collapsed: true },
          n.paragraph('parent'),
          n.list({ kind: 'bullet' }, n.paragraph('child')),
        ),
      ),
    )
    await expect.element(pmRoot.getByText('parent')).toBeVisible()
    await expect.element(pmRoot.getByText('child')).not.toBeVisible()

    // Expand the top-level bullet (its node starts at position 0).
    editor.view.dispatch(editor.view.state.tr.setNodeAttribute(0, 'collapsed', false))
    await expect.element(pmRoot.getByText('child')).toBeVisible()
  })

  it('folds when the bullet marker is clicked', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(
      n.doc(
        n.list(
          { kind: 'bullet', collapsed: false },
          n.paragraph('parent'),
          n.list({ kind: 'bullet' }, n.paragraph('child')),
        ),
      ),
    )
    await expect.element(pmRoot.getByText('child')).toBeVisible()

    await userEvent.click(pmRoot.locate('.list-marker-click-target').first())
    expect(fixture.doc.child(0).attrs.collapsed).toBe(true)
    await expect.element(pmRoot.getByText('child')).not.toBeVisible()
  })
})
