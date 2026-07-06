import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { setupFixture } from '../testing/index.ts'

const pmRoot = page.locate('.ProseMirror')

describe('toggleListCollapsed', () => {
  it('folds and unfolds a bullet that has children', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(
      n.doc(
        n.list(
          { kind: 'bullet' },
          n.paragraph('<a>parent'),
          n.list({ kind: 'bullet' }, n.paragraph('child')),
        ),
      ),
    )

    expect(editor.commands.toggleListCollapsed.canExec()).toBe(true)
    editor.commands.toggleListCollapsed()
    expect(fixture.doc.child(0).attrs.collapsed).toBe(true)
    editor.commands.toggleListCollapsed()
    expect(fixture.doc.child(0).attrs.collapsed).toBe(false)
  })

  it('cannot fold a leaf bullet', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.list({ kind: 'bullet' }, n.paragraph('<a>leaf'))))
    expect(editor.commands.toggleListCollapsed.canExec()).toBe(false)
  })

  it('does not fold a task', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(
      n.doc(
        n.list({ kind: 'task' }, n.paragraph('<a>a'), n.list({ kind: 'bullet' }, n.paragraph('b'))),
      ),
    )
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

describe('deleting a selection that contains a folded bullet', () => {
  it('expands hidden content before deleting', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture

    const doc1 = n.doc(
      n.paragraph('alpha'),
      n.list(
        { kind: 'bullet', collapsed: true },
        n.paragraph('folded parent'),
        n.list({ kind: 'bullet' }, n.paragraph('hidden <a>child<b>')),
      ),
      n.paragraph('beta'),
    )

    const doc2 = n.doc(
      n.paragraph('alpha'),
      n.list(
        { kind: 'bullet', collapsed: false },
        n.paragraph('folded parent'),
        n.list({ kind: 'bullet' }, n.paragraph('hidden child')),
      ),
      n.paragraph('beta'),
    )

    const doc3 = n.doc(
      n.paragraph('alpha'),
      n.list(
        { kind: 'bullet', collapsed: false },
        n.paragraph('folded parent'),
        n.list({ kind: 'bullet' }, n.paragraph('hidden ')),
      ),
      n.paragraph('beta'),
    )

    fixture.set(doc1)
    editor.view.focus()

    expect(fixture.state.toJSON()).toMatchInlineSnapshot(`
      {
        "doc": {
          "attrs": {
            "frontmatter": null,
          },
          "content": [
            {
              "content": [
                {
                  "text": "alpha",
                  "type": "text",
                },
              ],
              "type": "paragraph",
            },
            {
              "attrs": {
                "checked": false,
                "collapsed": true,
                "kind": "bullet",
                "marker": null,
                "markerGap": 1,
                "order": null,
                "taskMarker": null,
              },
              "content": [
                {
                  "content": [
                    {
                      "text": "folded parent",
                      "type": "text",
                    },
                  ],
                  "type": "paragraph",
                },
                {
                  "attrs": {
                    "checked": false,
                    "collapsed": false,
                    "kind": "bullet",
                    "marker": null,
                    "markerGap": 1,
                    "order": null,
                    "taskMarker": null,
                  },
                  "content": [
                    {
                      "content": [
                        {
                          "text": "hidden child",
                          "type": "text",
                        },
                      ],
                      "type": "paragraph",
                    },
                  ],
                  "type": "list",
                },
              ],
              "type": "list",
            },
            {
              "content": [
                {
                  "text": "beta",
                  "type": "text",
                },
              ],
              "type": "paragraph",
            },
          ],
          "type": "doc",
        },
        "selection": {
          "anchor": 32,
          "head": 37,
          "type": "text",
        },
      }
    `)

    await userEvent.keyboard('{Backspace}')
    expect(fixture.doc.toJSON()).toEqual(doc2.toJSON())
    await userEvent.keyboard('{Backspace}')
    expect(fixture.doc.toJSON()).toEqual(doc3.toJSON())
  })

  it('deletes everything on the first Backspace in an AllSelection', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture

    let doc1 = n.doc(
      n.paragraph('alpha'),
      n.list(
        { kind: 'bullet', collapsed: true },
        n.paragraph('folded parent'),
        n.list({ kind: 'bullet' }, n.paragraph('hidden child')),
      ),
      n.paragraph('beta<a>'),
    )

    let doc2 = n.doc(n.paragraph())

    fixture.set(doc1)
    editor.view.focus()
    editor.commands.selectAll()

    await userEvent.keyboard('{Backspace}')
    expect(fixture.doc.toJSON()).toEqual(doc2)
  })
})
