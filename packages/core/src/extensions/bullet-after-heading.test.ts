import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { setupFixture, type Fixture } from '../testing/index.ts'

import { defineBulletAfterHeading } from './bullet-after-heading.ts'

function useBulletAfterHeading(fixture: Fixture): void {
  fixture.editor.use(defineBulletAfterHeading())
}

function hasBulletList(fixture: Fixture): boolean {
  let found = false
  fixture.doc.descendants((node) => {
    if (node.type.name === 'list' && node.attrs.kind === 'bullet') {
      found = true
    }
  })
  return found
}

describe('defineBulletAfterHeading', () => {
  it('starts an empty bullet on Enter at the end of a heading', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    useBulletAfterHeading(fixture)
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
    const { n } = fixture
    useBulletAfterHeading(fixture)
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

  it('works for any heading, not just the first, inserting between it and the next block', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    useBulletAfterHeading(fixture)
    fixture.set(
      n.doc(n.paragraph('intro'), n.heading({ level: 2 }, 'Section<a>'), n.paragraph('body')),
    )
    fixture.view.focus()
    await userEvent.keyboard('{Enter}')
    const expected = n.doc(
      n.paragraph('intro'),
      n.heading({ level: 2 }, 'Section'),
      n.list({ kind: 'bullet' }, n.paragraph()),
      n.paragraph('body'),
    )
    expect(fixture.doc.eq(expected)).toBe(true)
  })

  it('leaves Enter in the middle of a heading to the default split', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    useBulletAfterHeading(fixture)
    fixture.set(n.doc(n.heading({ level: 1 }, 'Ti<a>tle')))
    fixture.view.focus()
    await userEvent.keyboard('{Enter}')
    expect(hasBulletList(fixture)).toBe(false)
  })

  it('leaves Enter in a paragraph to the default behavior', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    useBulletAfterHeading(fixture)
    fixture.set(n.doc(n.paragraph('text<a>')))
    fixture.view.focus()
    await userEvent.keyboard('{Enter}')
    expect(hasBulletList(fixture)).toBe(false)
  })
})
