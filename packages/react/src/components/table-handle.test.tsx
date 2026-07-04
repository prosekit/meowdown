import '../testing/index.ts'

import dedent from 'dedent'
import { createRef, type Ref } from 'react'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'

import { hover, unhover } from '../testing/mouse.ts'

import { ProseKitEditor } from './prosekit-editor.tsx'
import type { EditorHandle } from './types.ts'

const pmRoot = page.locate('.ProseMirror')
const columnHandle = page.getByTestId('table-handle-column')
const rowHandle = page.getByTestId('table-handle-row')
const columnMenu = page.getByTestId('table-handle-column-menu')
const rowMenu = page.getByTestId('table-handle-row-menu')

const TABLE_MARKDOWN = dedent`
  | a | b |
  | --- | --- |
  | 1 | 2 |
`

// The mouse position persists across tests; park it first so a leftover
// position over the new editor cannot open a handle.
async function renderEditor(ref?: Ref<EditorHandle>) {
  await unhover()
  return await render(<ProseKitEditor ref={ref} initialMarkdown={TABLE_MARKDOWN} />)
}

// The first body cell ("1") sits in column 0, row 1. Hovering it reveals both
// the column handle (above column 0) and the row handle (left of that row).
function firstBodyCell() {
  return pmRoot.locate('td').first()
}

describe('TableHandle', () => {
  it('shows the column and row handles when hovering a cell', async () => {
    await renderEditor()
    await expect.element(columnHandle).not.toBeVisible()
    await expect.element(rowHandle).not.toBeVisible()
    await hover(firstBodyCell())
    await expect.element(columnHandle).toBeVisible()
    await expect.element(rowHandle).toBeVisible()
  })

  it('inserts a column to the right', async () => {
    const ref = createRef<EditorHandle>()
    await renderEditor(ref)
    await hover(firstBodyCell())
    await columnHandle.click()
    await columnMenu.getByTestId('table-insert-right').click()
    expect(ref.current?.getMarkdown()).toBe('| a |  | b |\n| --- | --- | --- |\n| 1 |  | 2 |\n')
  })

  it('deletes a column', async () => {
    const ref = createRef<EditorHandle>()
    await renderEditor(ref)
    await hover(firstBodyCell())
    await columnHandle.click()
    await columnMenu.getByTestId('table-delete-column').click()
    expect(ref.current?.getMarkdown()).toBe('| b |\n| --- |\n| 2 |\n')
  })

  it('inserts a row below', async () => {
    const ref = createRef<EditorHandle>()
    await renderEditor(ref)
    await hover(firstBodyCell())
    await rowHandle.click()
    await rowMenu.getByTestId('table-insert-below').click()
    expect(ref.current?.getMarkdown()).toBe('| a | b |\n| --- | --- |\n| 1 | 2 |\n|  |  |\n')
  })

  it('deletes a row', async () => {
    const ref = createRef<EditorHandle>()
    await renderEditor(ref)
    await hover(firstBodyCell())
    await rowHandle.click()
    await rowMenu.getByTestId('table-delete-row').click()
    expect(ref.current?.getMarkdown()).toBe('| a | b |\n| --- | --- |\n')
  })

  it('deletes the whole table', async () => {
    const ref = createRef<EditorHandle>()
    await renderEditor(ref)
    await hover(firstBodyCell())
    await columnHandle.click()
    await columnMenu.getByTestId('table-delete-table-column').click()
    expect(ref.current?.getMarkdown().includes('|')).toBe(false)
  })

  it('aligns a column to the center', async () => {
    const ref = createRef<EditorHandle>()
    await renderEditor(ref)
    await hover(firstBodyCell())
    await columnHandle.click()
    await columnMenu.getByTestId('table-align-center').click()
    expect(ref.current?.getMarkdown()).toBe('| a | b |\n| :-: | --- |\n| 1 | 2 |\n')
    await expect.element(pmRoot.locate('th[data-align="center"]')).toBeVisible()
    await expect.element(pmRoot.locate('td[data-align="center"]')).toBeVisible()
  })

  it('marks the active alignment and clears it on a second click', async () => {
    const ref = createRef<EditorHandle>()
    await renderEditor(ref)
    await hover(firstBodyCell())
    await columnHandle.click()
    await columnMenu.getByTestId('table-align-right').click()
    expect(ref.current?.getMarkdown()).toBe('| a | b |\n| --: | --- |\n| 1 | 2 |\n')

    await hover(firstBodyCell())
    await columnHandle.click()
    await expect.element(columnMenu.getByTestId('table-align-right')).toHaveAttribute('data-active')
    await columnMenu.getByTestId('table-align-right').click()
    expect(ref.current?.getMarkdown()).toBe('| a | b |\n| --- | --- |\n| 1 | 2 |\n')
  })

  it('keeps the column alignment in an inserted row', async () => {
    const ref = createRef<EditorHandle>()
    await renderEditor(ref)
    await hover(firstBodyCell())
    await columnHandle.click()
    await columnMenu.getByTestId('table-align-center').click()

    await hover(firstBodyCell())
    await rowHandle.click()
    await rowMenu.getByTestId('table-insert-below').click()
    expect(ref.current?.getMarkdown()).toBe('| a | b |\n| :-: | --- |\n| 1 | 2 |\n|  |  |\n')
    await expect.element(pmRoot.locate('tr').last().locate('td[data-align="center"]')).toBeVisible()
  })
})
