import { NodeSelection } from '@prosekit/pm/state'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { setupFixture } from '../testing/index.ts'

function setupBackspaceFixture() {
  return setupFixture({ extensionOptions: { backspaceDeletesEmptyFirstBlock: true } })
}

describe('defineBackspaceEmptyFirstBlock', () => {
  it('deletes an empty first paragraph before a paragraph', async () => {
    using fixture = setupBackspaceFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>'), n.paragraph('foo'), n.paragraph('bar')))
    fixture.view.focus()
    await userEvent.keyboard('{Backspace}')
    expect(fixture.doc.eq(n.doc(n.paragraph('foo'), n.paragraph('bar')))).toBe(true)
  })

  it('drops the caret at the start of the next block', async () => {
    using fixture = setupBackspaceFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>'), n.paragraph('foo')))
    fixture.view.focus()
    await userEvent.keyboard('{Backspace}')
    await userEvent.keyboard('x')
    expect(fixture.doc.eq(n.doc(n.paragraph('xfoo')))).toBe(true)
  })

  it('keeps a following heading as a heading', async () => {
    using fixture = setupBackspaceFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>'), n.heading({ level: 2 }, 'foo')))
    fixture.view.focus()
    await userEvent.keyboard('{Backspace}')
    expect(fixture.doc.eq(n.doc(n.heading({ level: 2 }, 'foo')))).toBe(true)
  })

  it('keeps a following list as a list', async () => {
    using fixture = setupBackspaceFixture()
    const { n } = fixture
    fixture.set(
      n.doc(
        n.paragraph('<a>'),
        n.list({ kind: 'bullet' }, n.paragraph('foo')),
        n.list({ kind: 'bullet' }, n.paragraph('bar')),
      ),
    )
    fixture.view.focus()
    await userEvent.keyboard('{Backspace}')
    const expected = n.doc(
      n.list({ kind: 'bullet' }, n.paragraph('foo')),
      n.list({ kind: 'bullet' }, n.paragraph('bar')),
    )
    expect(fixture.doc.eq(expected)).toBe(true)
  })

  it('keeps a following code block as a code block', async () => {
    using fixture = setupBackspaceFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>'), n.codeBlock('foo')))
    fixture.view.focus()
    await userEvent.keyboard('{Backspace}')
    expect(fixture.doc.eq(n.doc(n.codeBlock('foo')))).toBe(true)
  })

  it('selects a following horizontal rule', async () => {
    using fixture = setupBackspaceFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>'), n.horizontalRule(), n.paragraph('foo')))
    fixture.view.focus()
    await userEvent.keyboard('{Backspace}')
    expect(fixture.doc.eq(n.doc(n.horizontalRule(), n.paragraph('foo')))).toBe(true)
    expect(fixture.state.selection).toBeInstanceOf(NodeSelection)
  })

  it('deletes one empty paragraph per press', async () => {
    using fixture = setupBackspaceFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>'), n.paragraph(), n.paragraph('foo')))
    fixture.view.focus()
    await userEvent.keyboard('{Backspace}')
    expect(fixture.doc.eq(n.doc(n.paragraph(), n.paragraph('foo')))).toBe(true)
    await userEvent.keyboard('{Backspace}')
    expect(fixture.doc.eq(n.doc(n.paragraph('foo')))).toBe(true)
  })

  it('leaves a non-empty first paragraph alone', async () => {
    using fixture = setupBackspaceFixture()
    const { n } = fixture
    const doc = n.doc(n.paragraph('<a>foo'), n.paragraph('bar'))
    fixture.set(doc)
    fixture.view.focus()
    await userEvent.keyboard('{Backspace}')
    expect(fixture.doc.eq(doc)).toBe(true)
  })

  it('still joins an empty paragraph that is not the first block', async () => {
    using fixture = setupBackspaceFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('foo'), n.paragraph('<a>'), n.paragraph('bar')))
    fixture.view.focus()
    await userEvent.keyboard('{Backspace}')
    await userEvent.keyboard('x')
    expect(fixture.doc.eq(n.doc(n.paragraph('foox'), n.paragraph('bar')))).toBe(true)
  })

  it('does nothing when the option is off', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    const doc = n.doc(n.paragraph('<a>'), n.paragraph('foo'))
    fixture.set(doc)
    fixture.view.focus()
    await userEvent.keyboard('{Backspace}')
    expect(fixture.doc.eq(doc)).toBe(true)
  })
})
