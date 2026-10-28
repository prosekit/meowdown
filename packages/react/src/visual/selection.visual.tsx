import '../testing/index.ts'

import { isNodeOfType } from '@meowdown/core'
import type { EditorNode } from '@prosekit/pm/model'
import dedent from 'dedent'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { MarkdownEditor } from '../components/editor.tsx'
import type { EditorHandle } from '../components/types.ts'
import { hover, unhover } from '../testing/mouse.ts'
import { expectScreenshots, renderVisual } from '../testing/visual.tsx'

const pmRoot = page.locate('.ProseMirror')
const slashMenu = page.getByTestId('slash-menu')

const TABLE_MARKDOWN = dedent`
  Some text above the table.

  | Name | Kind | Price |
  | --- | --- | --- |
  | Apple | Fruit | 1.20 |
  | Carrot | Vegetable | 0.80 |
  | Rice | Grain | 2.50 |

  Some text below the table.
`

async function setupEditor(markdown: string) {
  await unhover()
  const ref = createRef<EditorHandle>()
  await renderVisual(<MarkdownEditor handleRef={ref} initialMarkdown={markdown} />)
  await expect.element(pmRoot).toBeVisible()
  const handle = ref.current
  if (!handle) throw new Error('editor not mounted')
  return handle
}

function getDoc(handle: EditorHandle): EditorNode {
  const editor = handle.getEditor()
  if (!editor) throw new Error('editor not mounted')
  return editor.state.doc
}

/**
 * The position before each cell, by row and column.
 */ // FIXME: move helpful functions like this into packages/react/src/testing/visual.tsx
function getCellPositions(doc: EditorNode): number[][] {
  const rows: number[][] = []
  doc.descendants((node, pos) => {
    if (isNodeOfType(node, 'tableRow')) {
      rows.push([])
    } else if (isNodeOfType(node, 'tableCell') || isNodeOfType(node, 'tableHeaderCell')) {
      rows.at(-1)?.push(pos)
      return false
    }
    return true
  })
  return rows
}

function getTextPosition(doc: EditorNode, query: string): number {
  let found = -1
  doc.descendants((node, pos) => {
    if (found >= 0) return false
    const index = node.isText ? (node.text ?? '').indexOf(query) : -1
    if (index >= 0) found = pos + index
    return true
  })
  if (found < 0) throw new Error(`text not found: ${query}`)
  return found
}

async function selectCells(
  handle: EditorHandle,
  [anchorRow, anchorColumn]: [number, number],
  [headRow, headColumn]: [number, number],
) {
  const cells = getCellPositions(getDoc(handle))
  handle.focus()
  handle.setSelection({
    type: 'cell',
    anchor: cells[anchorRow][anchorColumn],
    head: cells[headRow][headColumn],
  })
  await expect.element(pmRoot.locate('.selectedCell').first()).toBeInTheDocument()
}

describe('table selection', () => {
  it('selects the whole table with the block handle', async () => {
    await setupEditor(TABLE_MARKDOWN)
    await hover(pmRoot.locate('table'))
    await page.getByTestId('block-handle-drag').click()
    await expect.element(pmRoot.locate('table.ProseMirror-selectednode')).toBeInTheDocument()
    await unhover()
    await expectScreenshots('table-select-node')
  })

  it('selects all cells', async () => {
    const handle = await setupEditor(TABLE_MARKDOWN)
    await selectCells(handle, [0, 0], [3, 2])
    await expectScreenshots('table-select-all-cells')
  })

  it('selects a 2x2 cell block', async () => {
    const handle = await setupEditor(TABLE_MARKDOWN)
    await selectCells(handle, [1, 1], [2, 2])
    await expectScreenshots('table-select-block')
  })

  it('selects one row', async () => {
    const handle = await setupEditor(TABLE_MARKDOWN)
    await selectCells(handle, [2, 0], [2, 2])
    await expectScreenshots('table-select-row')
  })

  it('selects one column', async () => {
    const handle = await setupEditor(TABLE_MARKDOWN)
    await selectCells(handle, [0, 1], [3, 1])
    await expectScreenshots('table-select-column')
  })
})

describe('text selection', () => {
  it('selects text inside a paragraph', async () => {
    const handle = await setupEditor(
      'Meowdown is a hybrid live-preview Markdown editor with **bold** and *italic* text.',
    )
    const doc = getDoc(handle)
    handle.focus()
    handle.setSelection({
      type: 'text',
      anchor: getTextPosition(doc, 'live-preview'),
      head: getTextPosition(doc, ' editor'),
    })
    await expectScreenshots('text-select-paragraph')
  })

  it('selects text across list items', async () => {
    const handle = await setupEditor(dedent`
      - [ ] First task
      - [x] Second task
        - [ ] Nested task
      - Bullet item

      A paragraph after the list.
    `)
    const doc = getDoc(handle)
    handle.focus()
    handle.setSelection({
      type: 'text',
      anchor: getTextPosition(doc, 'task'),
      head: getTextPosition(doc, 'after'),
    })
    await expectScreenshots('text-select-lists')
  })
})

describe('slash menu', () => {
  it('opens the slash menu in an empty paragraph', async () => {
    await setupEditor('Type a slash below.\n\n')
    await pmRoot.locate('p').last().click()
    await userEvent.keyboard('/')
    await expect.element(slashMenu).toBeVisible()
    await expectScreenshots('slash-menu')
  })
})
