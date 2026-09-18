import { NodeSelection } from '@prosekit/pm/state'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture } from '../testing/index.ts'

import { swapTopLevelBlock } from './move-block.ts'

const pressAltUp = () => userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}')
const pressAltDown = () => userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}')

describe('defineMoveBlock', () => {
  it('Alt-ArrowUp swaps a list item with the one above', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(
      n.doc(
        n.list({ kind: 'bullet' }, n.paragraph('a')),
        n.list({ kind: 'bullet' }, n.paragraph('b<a>')),
      ),
    )
    fixture.view.focus()
    await pressAltUp()
    expect(docToMarkdown(fixture.doc)).toBe('- b\n- a\n')
  })

  it('Alt-ArrowDown swaps a list item with the one below', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(
      n.doc(
        n.list({ kind: 'bullet' }, n.paragraph('a<a>')),
        n.list({ kind: 'bullet' }, n.paragraph('b')),
      ),
    )
    fixture.view.focus()
    await pressAltDown()
    expect(docToMarkdown(fixture.doc)).toBe('- b\n- a\n')
  })

  it('moves a list item together with its nested children', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(
      n.doc(
        n.list({ kind: 'bullet' }, n.paragraph('a')),
        n.list(
          { kind: 'bullet' },
          n.paragraph('b<a>'),
          n.list({ kind: 'bullet' }, n.paragraph('b1')),
        ),
      ),
    )
    fixture.view.focus()
    await pressAltUp()
    expect(docToMarkdown(fixture.doc)).toBe('- b\n  - b1\n- a\n')
  })

  it('moves a checked task item preserving its marker', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(
      n.doc(
        n.list({ kind: 'bullet' }, n.paragraph('a')),
        n.list({ kind: 'task', checked: true }, n.paragraph('done<a>')),
      ),
    )
    fixture.view.focus()
    await pressAltUp()
    expect(docToMarkdown(fixture.doc)).toBe('- [x] done\n- a\n')
  })

  it('Alt-ArrowUp swaps a plain paragraph with the block above', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('p1'), n.paragraph('p2<a>')))
    fixture.view.focus()
    await pressAltUp()
    expect(docToMarkdown(fixture.doc)).toBe('p2\n\np1\n')
  })

  it('Alt-ArrowDown swaps a paragraph with a heading below', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('p1<a>'), n.heading({ level: 2 }, 'title')))
    fixture.view.focus()
    await pressAltDown()
    expect(docToMarkdown(fixture.doc)).toBe('## title\n\np1\n')
  })

  it('keeps the caret inside the moved block', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('p1'), n.paragraph('p<a>2')))
    fixture.view.focus()
    await pressAltUp()
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`
      "
      p┃2
      p1
      "
    `)
  })

  it('moves a node-selected block, keeping it selected', async () => {
    using fixture = setupFixture()
    const { n, view } = fixture
    fixture.set(n.doc(n.paragraph('p1'), n.horizontalRule(), n.paragraph('p2')))
    const hrPos = view.state.doc.child(0).nodeSize
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, hrPos)))
    view.focus()
    await pressAltUp()
    expect(docToMarkdown(fixture.doc)).toBe('---\n\np1\n\np2\n')
    const { selection } = fixture.state
    expect(selection).toBeInstanceOf(NodeSelection)
    expect((selection as NodeSelection).node.type.name).toBe('horizontalRule')
  })

  it('moves the whole blockquote when the caret sits inside it', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('p1'), n.blockquote(n.paragraph('q<a>uote'))))
    fixture.view.focus()
    await pressAltUp()
    expect(docToMarkdown(fixture.doc)).toBe('> quote\n\np1\n')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`
      "
      q┃uote
      p1
      "
    `)
  })

  it('does nothing at the document top and bottom', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('p1<a>'), n.paragraph('p2')))
    fixture.view.focus()
    await pressAltUp()
    expect(docToMarkdown(fixture.doc)).toBe('p1\n\np2\n')

    fixture.set(n.doc(n.paragraph('p1'), n.paragraph('p2<a>')))
    fixture.view.focus()
    await pressAltDown()
    expect(docToMarkdown(fixture.doc)).toBe('p1\n\np2\n')
  })

  it('does nothing inside a table cell', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(
      n.doc(
        n.paragraph('before'),
        n.table(
          n.tableRow(n.tableHeaderCell(n.paragraph('a<a>')), n.tableHeaderCell(n.paragraph('b'))),
          n.tableRow(n.tableCell(n.paragraph('1')), n.tableCell(n.paragraph('2'))),
        ),
      ),
    )
    const before = docToMarkdown(fixture.doc)
    fixture.view.focus()
    await pressAltUp()
    expect(docToMarkdown(fixture.doc)).toBe(before)
  })

  it('swapTopLevelBlock rejects a selection spanning two top-level blocks', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('p<a>1'), n.paragraph('p<b>2'), n.paragraph('p3')))
    expect(swapTopLevelBlock(1)(fixture.state)).toBe(false)
  })
})
