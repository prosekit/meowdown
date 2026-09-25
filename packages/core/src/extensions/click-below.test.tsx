import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { setupFixture } from '../testing/index.ts'

const pmRoot = page.locate('.ProseMirror')

async function clickBelowLastBlock(): Promise<void> {
  const rect = pmRoot.element().getBoundingClientRect()
  await userEvent.click(pmRoot, { position: { x: rect.width / 2, y: rect.height - 4 } })
}

describe('a click below the last block', () => {
  it('adds a paragraph below a code block', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock('code')))
    await clickBelowLastBlock()
    await userEvent.keyboard('X')
    expect(fixture.doc.eq(n.doc(n.codeBlock('code'), n.paragraph('X')))).toBe(true)
  })

  it('adds a paragraph below a blockquote', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.blockquote(n.paragraph('quote'))))
    await clickBelowLastBlock()
    await userEvent.keyboard('X')
    expect(fixture.doc.eq(n.doc(n.blockquote(n.paragraph('quote')), n.paragraph('X')))).toBe(true)
  })

  it('adds a paragraph below a list', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.list({ kind: 'bullet' }, n.paragraph('item'))))
    await clickBelowLastBlock()
    await userEvent.keyboard('X')
    const expected = n.doc(n.list({ kind: 'bullet' }, n.paragraph('item')), n.paragraph('X'))
    expect(fixture.doc.eq(expected)).toBe(true)
  })
})

describe('a click below an empty bottom line', () => {
  it('puts the caret in an empty bullet', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.list({ kind: 'bullet' }, n.paragraph())))
    await clickBelowLastBlock()
    await userEvent.keyboard('X')
    expect(fixture.doc.eq(n.doc(n.list({ kind: 'bullet' }, n.paragraph('X'))))).toBe(true)
  })

  it('puts the caret in an empty last item', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(
      n.doc(
        n.list({ kind: 'bullet' }, n.paragraph('a')),
        n.list({ kind: 'bullet' }, n.paragraph()),
      ),
    )
    await clickBelowLastBlock()
    await userEvent.keyboard('X')
    const expected = n.doc(
      n.list({ kind: 'bullet' }, n.paragraph('a')),
      n.list({ kind: 'bullet' }, n.paragraph('X')),
    )
    expect(fixture.doc.eq(expected)).toBe(true)
  })

  it('puts the caret in an empty nested item', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(
      n.doc(
        n.list({ kind: 'bullet' }, n.paragraph('a'), n.list({ kind: 'bullet' }, n.paragraph())),
      ),
    )
    await clickBelowLastBlock()
    await userEvent.keyboard('X')
    const expected = n.doc(
      n.list({ kind: 'bullet' }, n.paragraph('a'), n.list({ kind: 'bullet' }, n.paragraph('X'))),
    )
    expect(fixture.doc.eq(expected)).toBe(true)
  })

  it('puts the caret in an empty task', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.list({ kind: 'task' }, n.paragraph())))
    await clickBelowLastBlock()
    await userEvent.keyboard('X')
    expect(fixture.doc.eq(n.doc(n.list({ kind: 'task' }, n.paragraph('X'))))).toBe(true)
  })

  it('puts the caret on an empty last line of a blockquote', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.blockquote(n.paragraph('quote'), n.paragraph())))
    await clickBelowLastBlock()
    await userEvent.keyboard('X')
    const expected = n.doc(n.blockquote(n.paragraph('quote'), n.paragraph('X')))
    expect(fixture.doc.eq(expected)).toBe(true)
  })

  it('keeps the caret visible when the empty line is folded away', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(
      n.doc(
        n.list(
          { kind: 'bullet', collapsed: true },
          n.paragraph('a'),
          n.list({ kind: 'bullet' }, n.paragraph()),
        ),
      ),
    )
    await clickBelowLastBlock()
    await userEvent.keyboard('X')
    const expected = n.doc(
      n.list(
        { kind: 'bullet', collapsed: true },
        n.paragraph('aX'),
        n.list({ kind: 'bullet' }, n.paragraph()),
      ),
    )
    expect(fixture.doc.eq(expected)).toBe(true)
  })

  it('adds a paragraph below a table with an empty last cell', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    const table = n.table(
      n.tableRow(n.tableHeaderCell(n.paragraph('a')), n.tableHeaderCell(n.paragraph('b'))),
      n.tableRow(n.tableCell(n.paragraph('1')), n.tableCell(n.paragraph())),
    )
    fixture.set(n.doc(table))
    await clickBelowLastBlock()
    expect(fixture.doc.eq(n.doc(table, n.paragraph()))).toBe(true)
  })
})
