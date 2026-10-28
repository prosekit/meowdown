import '../testing/index.ts'

import dedent from 'dedent'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { MarkdownEditor } from '../components/editor.tsx'
import type { EditorHandle } from '../components/types.ts'
import { hover, unhover } from '../testing/mouse.ts'
import { expectScreenshots, renderVisual, selectCells, selectText } from '../testing/visual.tsx'

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
    selectText(handle, 'live-preview', ' editor')
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
    selectText(handle, 'task', 'after')
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
