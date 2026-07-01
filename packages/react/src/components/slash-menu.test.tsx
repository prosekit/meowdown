import '../testing/index.ts'

import type { EditorNode } from '@prosekit/pm/model'
import { TextSelection } from '@prosekit/pm/state'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'

import { ProseKitEditor } from './prosekit-editor.tsx'
import type { EditorHandle, SlashMenuItem } from './types.ts'

const pmRoot = page.locate('.ProseMirror')
const menu = page.getByTestId('slash-menu')

const LABELS = [
  'Heading 1',
  'Heading 2',
  'Heading 3',
  'Heading 4',
  'Blockquote',
  'Bullet list',
  'Ordered list',
  'Task list',
  'Checkbox list',
  'Code block',
  'Table',
  'Now',
]

describe('SlashMenu', () => {
  it('opens when typing "/" and lists the block types', async () => {
    await render(<ProseKitEditor />)
    await pmRoot.click()
    await expect.element(menu).not.toBeVisible()
    await userEvent.keyboard('/')
    await expect.element(menu).toBeVisible()
    for (const label of LABELS) {
      await expect.element(menu.getByText(label)).toBeVisible()
    }
  })

  it('filters the items by the query', async () => {
    await render(<ProseKitEditor />)
    await pmRoot.click()
    await userEvent.keyboard('/table')
    await expect.element(menu.getByText('Table')).toBeVisible()
    await expect.element(menu.getByText('Heading 1')).not.toBeVisible()
  })

  it('applies the selected block type and removes the query text', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} />)
    await pmRoot.click()
    await userEvent.keyboard('/head')
    await menu.getByText('Heading 1').click()

    await expect.element(pmRoot.locate('h1')).toBeInTheDocument()
    await userEvent.keyboard('Hello')
    expect(ref.current?.getMarkdown()).toBe('# Hello\n')
  })

  it('wraps the current block in a circle checkbox task', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} />)
    await pmRoot.click()
    await userEvent.keyboard('Buy milk /task')
    await menu.getByText('Task list', { exact: true }).click()

    expect(ref.current?.getMarkdown()).toContain('+ [ ] Buy milk')
  })

  it('wraps the current block in a square checkbox task', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} />)
    await pmRoot.click()
    await userEvent.keyboard('Buy milk /checkbox')
    await menu.getByText('Checkbox list', { exact: true }).click()

    expect(ref.current?.getMarkdown()).toContain('- [ ] Buy milk')
  })

  it('inserts the current time in 12-hour format by default', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} />)
    await pmRoot.click()
    await userEvent.keyboard('/now')
    await menu.getByText('Now', { exact: true }).click()

    expect(ref.current?.getMarkdown()).toMatch(/^\d{1,2}:\d{2}(am|pm)\n$/)
  })

  it('inserts the current time in 24-hour format when timeFormat is "24"', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} timeFormat="24" />)
    await pmRoot.click()
    await userEvent.keyboard('/now')
    await menu.getByText('Now', { exact: true }).click()

    expect(ref.current?.getMarkdown()).toMatch(/^\d{2}:\d{2}\n$/)
  })

  it('shows host items after the built-in ones', async () => {
    const onSlashMenuSearch = (): SlashMenuItem[] => [
      { label: 'Meeting note', detail: 'Template', onSelect: () => {} },
      { label: 'Daily log', onSelect: () => {} },
    ]
    await render(<ProseKitEditor onSlashMenuSearch={onSlashMenuSearch} />)
    await pmRoot.click()
    await userEvent.keyboard('/')

    await expect.element(menu.getByText('Meeting note')).toBeVisible()
    await expect.element(menu.getByText('Template')).toBeVisible()
    await expect.element(menu.getByText('Daily log')).toBeVisible()

    const text = menu.element().textContent ?? ''
    expect(text.indexOf('Now')).toBeLessThan(text.indexOf('Meeting note'))
  })

  it('supports an async host search handler', async () => {
    const onSlashMenuSearch = async (): Promise<SlashMenuItem[]> => {
      await Promise.resolve()
      return [{ label: 'Async item', onSelect: () => {} }]
    }
    await render(<ProseKitEditor onSlashMenuSearch={onSlashMenuSearch} />)
    await pmRoot.click()
    await userEvent.keyboard('/')

    await expect.element(menu.getByText('Async item')).toBeVisible()
  })

  it('filters host items by the query like the built-in items', async () => {
    const onSlashMenuSearch = (): SlashMenuItem[] => [
      { label: 'Meeting note', onSelect: () => {} },
      { label: 'Daily log', onSelect: () => {} },
    ]
    await render(<ProseKitEditor onSlashMenuSearch={onSlashMenuSearch} />)
    await pmRoot.click()
    await userEvent.keyboard('/meeting')

    await expect.element(menu.getByText('Meeting note')).toBeVisible()
    await expect.element(menu.getByText('Daily log')).not.toBeVisible()
    await expect.element(menu.getByText('Heading 1')).not.toBeVisible()
  })

  it('closes the menu and calls onSelect on a host item click', async () => {
    const onSelect = vi.fn()
    const onSlashMenuSearch = (): SlashMenuItem[] => [{ label: 'Meeting note', onSelect }]
    await render(<ProseKitEditor onSlashMenuSearch={onSlashMenuSearch} />)
    await pmRoot.click()
    await userEvent.keyboard('/meet')
    await menu.getByText('Meeting note').click()

    await expect.element(menu).not.toBeVisible()
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('removes the typed query text before a host onSelect runs', async () => {
    const ref = createRef<EditorHandle>()
    const onSlashMenuSearch = (): SlashMenuItem[] => [
      // The host inserts at the cursor: the `/meet` text is already gone, so
      // the fragment lands right after "Hello ".
      { label: 'Meeting note', onSelect: () => ref.current?.insertMarkdown('**Agenda**') },
    ]
    await render(<ProseKitEditor ref={ref} onSlashMenuSearch={onSlashMenuSearch} />)
    await pmRoot.click()
    await userEvent.keyboard('Hello /meet')
    await menu.getByText('Meeting note').click()

    expect(ref.current?.getMarkdown()).toBe('Hello **Agenda**\n')
  })

  it('omits block items inside a table cell but keeps inline items', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} initialMarkdown={'| a | b |\n| --- | --- |\n|  |  |'} />)
    await pmRoot.click()

    const view = ref.current?.editor?.view
    if (!view) throw new Error('editor not mounted')
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(view.state.doc, firstBodyCellCaret(view.state.doc)),
      ),
    )
    view.focus()

    await userEvent.keyboard('/')
    await expect.element(menu).toBeVisible()
    await expect.element(menu.getByText('Now')).toBeVisible()
    for (const label of ['Heading 1', 'Blockquote', 'Bullet list', 'Code block', 'Table']) {
      await expect.element(menu.getByText(label)).not.toBeInTheDocument()
    }
  })
})

/** A caret position inside the first body cell's paragraph. */
function firstBodyCellCaret(doc: EditorNode): number {
  let caret = -1
  doc.descendants((node, pos) => {
    if (caret < 0 && node.type.name === 'tableCell') caret = pos + 2
    return caret < 0
  })
  if (caret < 0) throw new Error('no body cell found')
  return caret
}
