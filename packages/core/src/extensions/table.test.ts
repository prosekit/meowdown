import { getNodeType } from '@prosekit/core'
import { Fragment, type EditorNode } from '@prosekit/pm/model'
import { NodeSelection } from '@prosekit/pm/state'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { setupFixture } from '../testing/index.ts'

describe('table', () => {
  it('deletes the whole selected table when Backspace', async () => {
    using fixture = setupFixture()
    const { n, view } = fixture
    const doc = n.doc(
      n.paragraph('before'),
      n.table(
        n.tableRow(n.tableHeaderCell(n.paragraph('a')), n.tableHeaderCell(n.paragraph('b'))),
        n.tableRow(n.tableCell(n.paragraph('1')), n.tableCell(n.paragraph('2'))),
      ),
    )
    fixture.set(doc)

    const tablePos = getTablePos(fixture.doc)
    const selection = NodeSelection.create(view.state.doc, tablePos)
    view.dispatch(view.state.tr.setSelection(selection))

    view.focus()
    expect(hasTable(fixture.doc)).toBe(true)
    await userEvent.keyboard('{Backspace}')
    expect(hasTable(fixture.doc)).toBe(false)
  })

  it('clears only the selected cells when Backspace over a partial cell selection', async () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    const doc = n.doc(
      n.paragraph('before'),
      n.table(
        n.tableRow(n.tableHeaderCell(n.paragraph('a')), n.tableHeaderCell(n.paragraph('b'))),
        n.tableRow(n.tableCell(n.paragraph('1')), n.tableCell(n.paragraph('2'))),
      ),
    )
    fixture.set(doc)

    const [headerA, headerB] = getCellHitPositions(fixture.doc)
    editor.commands.selectTableRow({ anchor: headerA, head: headerB })

    view.focus()
    await userEvent.keyboard('{Backspace}')

    expect(hasTable(fixture.doc)).toBe(true)
    expect(getCellTexts(fixture.doc)).toEqual(['', '', '1', '2'])
  })

  it('deletes the whole table when Backspace over a full cell selection', async () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    const doc = n.doc(
      n.paragraph('before'),
      n.table(
        n.tableRow(n.tableHeaderCell(n.paragraph('a')), n.tableHeaderCell(n.paragraph('b'))),
        n.tableRow(n.tableCell(n.paragraph('1')), n.tableCell(n.paragraph('2'))),
      ),
    )
    fixture.set(doc)

    const [headerA] = getCellHitPositions(fixture.doc)
    editor.commands.selectTable({ pos: headerA })

    view.focus()
    expect(hasTable(fixture.doc)).toBe(true)
    await userEvent.keyboard('{Backspace}')
    expect(hasTable(fixture.doc)).toBe(false)
  })
})

describe('table cell is inline-only', () => {
  it('cell schema forbids block children', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    const cellType = getNodeType(editor.schema, 'tableCell')
    const headerType = getNodeType(editor.schema, 'tableHeaderCell')
    const list = n.list({ kind: 'bullet' }, n.paragraph('x'))
    const nestedTable = n.table(n.tableRow(n.tableCell(n.paragraph('x'))))

    expect(cellType.validContent(Fragment.from(list))).toBe(false)
    expect(headerType.validContent(Fragment.from(list))).toBe(false)
    expect(cellType.validContent(Fragment.from(nestedTable))).toBe(false)
    expect(cellType.validContent(Fragment.from(n.paragraph('a')))).toBe(true)
    // A cell holds exactly one paragraph, so two paragraphs are rejected.
    expect(() => n.tableCell(n.paragraph('a'), n.paragraph('b'))).toThrow()
  })

  it('block-creating commands add nothing inside a cell', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    fixture.set(cellCaretTable(n))
    view.focus()

    // setBlockType/wrapIn commands gate on the schema, while flat-list's
    // wrapInList optimistically reports canExec but guards the actual wrap with
    // findWrapping. Either way, executing each must not nest a block in the cell.
    const commands = editor.commands
    commands.wrapInList({ kind: 'bullet' })
    commands.wrapInList({ kind: 'ordered' })
    commands.wrapInCircleTask()
    commands.wrapInSquareTask()
    commands.setBlockquote()
    commands.setHeading({ level: 1 })
    commands.setCodeBlock()

    expect(cellChildTypeNames(fixture.doc)).toEqual(['paragraph'])
    expect(maxCellChildCount(fixture.doc)).toBe(1)
  })

  it('keeps block-creating commands enabled outside a cell', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('<a>hello')))
    fixture.view.focus()

    const commands = editor.commands
    expect(commands.wrapInList.canExec({ kind: 'bullet' })).toBe(true)
    expect(commands.setBlockquote.canExec()).toBe(true)
    expect(commands.setHeading.canExec({ level: 1 })).toBe(true)
    expect(commands.setCodeBlock.canExec()).toBe(true)
    expect(commands.insertTable.canExec({ row: 2, col: 2, header: true })).toBe(true)
  })

  it('bullet list input rule is inert inside a cell', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(cellCaretTable(n))
    fixture.view.focus()

    await userEvent.keyboard('- ')
    expect(hasNodeType(fixture.doc, 'list')).toBe(false)
    expect(getCellTexts(fixture.doc)).toEqual(['a', 'b', '- ', '2'])
  })

  it.fails('horizontal rule input rule is inert inside a cell', async () => {
    // TODO: Remove `.fails` once https://github.com/prosekit/prosekit/pull/1708 is merged and released.
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(cellCaretTable(n))
    fixture.view.focus()

    await userEvent.keyboard('---')
    expect(hasNodeType(fixture.doc, 'horizontalRule')).toBe(false)
    expect(getCellTexts(fixture.doc)).toEqual(['a', 'b', '---', '2'])
  })

  it('horizontal rule input rule still fires outside a cell', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))
    fixture.view.focus()

    await userEvent.keyboard('---')
    expect(hasNodeType(fixture.doc, 'horizontalRule')).toBe(true)
  })

  it('Enter does not split a cell into two paragraphs', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(
      n.doc(
        n.table(
          n.tableRow(n.tableHeaderCell(n.paragraph('a')), n.tableHeaderCell(n.paragraph('b'))),
          n.tableRow(n.tableCell(n.paragraph('x<a>y')), n.tableCell(n.paragraph('2'))),
        ),
      ),
    )
    fixture.view.focus()

    await userEvent.keyboard('{Enter}')
    expect(maxCellChildCount(fixture.doc)).toBe(1)
  })
})

/** A header row plus a data row whose first cell holds the caret. */
function cellCaretTable(n: ReturnType<typeof setupFixture>['n']): EditorNode {
  return n.doc(
    n.table(
      n.tableRow(n.tableHeaderCell(n.paragraph('a')), n.tableHeaderCell(n.paragraph('b'))),
      n.tableRow(n.tableCell(n.paragraph('<a>')), n.tableCell(n.paragraph('2'))),
    ),
  )
}

function hasNodeType(doc: EditorNode, name: string): boolean {
  return countNodeType(doc, name) > 0
}

function countNodeType(doc: EditorNode, name: string): number {
  let count = 0
  doc.descendants((node) => {
    if (node.type.name === name) count++
    return true
  })
  return count
}

function cellChildTypeNames(doc: EditorNode): string[] {
  const names = new Set<string>()
  doc.descendants((node) => {
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeaderCell') {
      node.forEach((child) => names.add(child.type.name))
      return false
    }
    return true
  })
  return [...names].sort()
}

function maxCellChildCount(doc: EditorNode): number {
  let max = 0
  doc.descendants((node) => {
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeaderCell') {
      max = Math.max(max, node.childCount)
      return false
    }
    return true
  })
  return max
}

function getCellTexts(doc: EditorNode): string[] {
  const texts: string[] = []
  doc.descendants((node) => {
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeaderCell') {
      texts.push(node.textContent)
      return false
    }
    return true
  })
  return texts
}

function getCellHitPositions(doc: EditorNode): number[] {
  const positions: number[] = []
  doc.descendants((node, pos) => {
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeaderCell') {
      positions.push(pos + 1)
      return false
    }
    return true
  })
  return positions
}

function hasTable(doc: EditorNode): boolean {
  return getTablePos(doc) > -1
}

function getTablePos(doc: EditorNode): number {
  let tablePos = -1
  doc.forEach((node, offset) => {
    if (node.type.name === 'table') tablePos = offset
  })
  return tablePos
}
