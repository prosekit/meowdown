import { findNode } from '@prosekit/core'
import type { ProseMirrorNode } from '@prosekit/pm/model'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { setupFixture } from '../testing/index.ts'

import { defineBulletAfterHeading } from './bullet-after-heading.ts'

function isBulletList(node: ProseMirrorNode): boolean {
  return node.type.name === 'list' && node.attrs.kind === 'bullet'
}

describe('defineBulletAfterHeading', () => {
  it('starts an empty bullet on Enter at the end of the first heading', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineBulletAfterHeading())
    fixture.set(n.doc(n.heading({ level: 1 }, 'Title<a>')))
    fixture.view.focus()
    await userEvent.keyboard('{Enter}')
    const expected = n.doc(
      n.heading({ level: 1 }, 'Title'),
      n.list({ kind: 'bullet' }, n.paragraph()),
    )
    expect(fixture.doc.eq(expected)).toBe(true)
  })

  it('drops the caret into the new bullet', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineBulletAfterHeading())
    fixture.set(n.doc(n.heading({ level: 1 }, 'Title<a>')))
    fixture.view.focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('item')
    const expected = n.doc(
      n.heading({ level: 1 }, 'Title'),
      n.list({ kind: 'bullet' }, n.paragraph('item')),
    )
    expect(fixture.doc.eq(expected)).toBe(true)
  })

  it('inserts the bullet between the first heading and the following block', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineBulletAfterHeading())
    fixture.set(n.doc(n.heading({ level: 1 }, 'Title<a>'), n.paragraph('body')))
    fixture.view.focus()
    await userEvent.keyboard('{Enter}')
    const expected = n.doc(
      n.heading({ level: 1 }, 'Title'),
      n.list({ kind: 'bullet' }, n.paragraph()),
      n.paragraph('body'),
    )
    expect(fixture.doc.eq(expected)).toBe(true)
  })

  it('leaves a heading that is not the document first block to the default Enter', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineBulletAfterHeading())
    fixture.set(
      n.doc(n.paragraph('intro'), n.heading({ level: 2 }, 'Section<a>'), n.paragraph('body')),
    )
    fixture.view.focus()
    await userEvent.keyboard('{Enter}')
    expect(findNode(fixture.doc, isBulletList)).toBeUndefined()
  })

  it('leaves Enter in the middle of the first heading to the default split', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineBulletAfterHeading())
    fixture.set(n.doc(n.heading({ level: 1 }, 'Ti<a>tle')))
    fixture.view.focus()
    await userEvent.keyboard('{Enter}')
    expect(findNode(fixture.doc, isBulletList)).toBeUndefined()
  })

  it('leaves Enter in a paragraph to the default behavior', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineBulletAfterHeading())
    fixture.set(n.doc(n.paragraph('text<a>')))
    fixture.view.focus()
    await userEvent.keyboard('{Enter}')
    expect(findNode(fixture.doc, isBulletList)).toBeUndefined()
  })
})
