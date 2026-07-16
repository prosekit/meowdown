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
  'Text',
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
  'Math',
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
      await expect.element(menu.getByText(label, { exact: true })).toBeVisible()
    }
  })

  it('filters the items by the query', async () => {
    await render(<ProseKitEditor />)
    await pmRoot.click()
    await userEvent.keyboard('/table')
    await expect.element(menu.getByText('Table')).toBeVisible()
    await expect.element(menu.getByText('Heading 1')).not.toBeVisible()
  })

  it('inserts a table when Enter selects a normal single-slash command', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} />)
    await pmRoot.click()
    await userEvent.keyboard('/table')
    await expect.element(menu.getByText('Table')).toBeVisible()
    await userEvent.keyboard('{Enter}')

    await expect.element(menu).not.toBeVisible()
    await expect.element(page.locate('.ProseMirror table')).toBeInTheDocument()
    expect(ref.current?.getMarkdown()).not.toContain('/table')
  })

  it('closes immediately on a double slash and preserves following text on Enter', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} />)
    await pmRoot.click()
    await userEvent.keyboard('Name /')
    await expect.element(menu).toBeVisible()
    await userEvent.keyboard('/')
    await expect.element(menu).not.toBeVisible()
    await userEvent.keyboard(' Table')
    await expect.element(menu).not.toBeVisible()
    await userEvent.keyboard('{Enter}')

    await expect.element(page.locate('.ProseMirror table')).not.toBeInTheDocument()
    expect(ref.current?.getMarkdown()).toBe('Name // Table\n')
  })

  it('does not select a matching host template from double-slash text', async () => {
    const ref = createRef<EditorHandle>()
    const onSelect = vi.fn()
    const onSlashMenuSearch = (): SlashMenuItem[] => [{ label: 'Meeting note', onSelect }]
    await render(<ProseKitEditor ref={ref} onSlashMenuSearch={onSlashMenuSearch} />)
    await pmRoot.click()
    await userEvent.keyboard('Name /')
    await expect.element(menu).toBeVisible()
    await userEvent.keyboard('/')
    await expect.element(menu).not.toBeVisible()
    await userEvent.keyboard(' Meeting note')
    await expect.element(menu).not.toBeVisible()
    await userEvent.keyboard('{Enter}')

    expect(onSelect).not.toHaveBeenCalled()
    expect(ref.current?.getMarkdown()).toBe('Name // Meeting note\n')
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

  it('turns a heading back into a paragraph', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} />)
    await pmRoot.click()
    await userEvent.keyboard('/head')
    await menu.getByText('Heading 1').click()
    await userEvent.keyboard('Hello /text')
    await expect.element(pmRoot.locate('h1')).toBeInTheDocument()
    await menu.getByText('Text', { exact: true }).click()

    await expect.element(pmRoot.locate('h1')).not.toBeInTheDocument()
    expect(ref.current?.getMarkdown()).toMatchInlineSnapshot(`
      """
      Hello

      """
    `)
  })

  it('removes the bullet when Text is selected in a list item', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} />)
    await pmRoot.click()
    await userEvent.keyboard('- Buy milk /text')
    await expect.element(pmRoot.locate('.prosemirror-flat-list')).toBeInTheDocument()
    await menu.getByText('Text', { exact: true }).click()

    await expect.element(pmRoot.locate('.prosemirror-flat-list')).not.toBeInTheDocument()
    expect(ref.current?.getMarkdown()).toMatchInlineSnapshot(`
      """
      Buy milk

      """
    `)
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

  it('inserts a math code block', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} />)
    await pmRoot.click()
    await userEvent.keyboard('/math')
    await menu.getByText('Math', { exact: true }).click()

    expect(ref.current?.getMarkdown()).toBe('```math\n```\n')
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

  it('attaches a selected file through the slash menu', async () => {
    const ref = createRef<EditorHandle>()
    const onFilePaste = vi.fn((file: File) => `assets/${file.name}`)
    await render(<ProseKitEditor ref={ref} onFilePaste={onFilePaste} />)

    const input = page.getByTestId('slash-menu-file-input').element() as HTMLInputElement
    const inputClick = vi.spyOn(input, 'click').mockImplementation(() => {})
    await pmRoot.click()
    await userEvent.keyboard('Hello /attach')
    await menu.getByText('Attach file', { exact: true }).click()

    expect(inputClick).toHaveBeenCalledOnce()
    const files = new DataTransfer()
    files.items.add(new File(['%PDF'], 'report.pdf', { type: 'application/pdf' }))
    Object.defineProperty(input, 'files', { value: files.files, configurable: true })
    input.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      expect(onFilePaste).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ name: 'report.pdf' }),
      )
      expect(ref.current?.getMarkdown()).toBe('Hello [report.pdf](assets/report.pdf)\n')
    })
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

  it('matches host-item keywords, never displaying them', async () => {
    const onSlashMenuSearch = (): SlashMenuItem[] => [
      { label: 'Meeting note', keywords: ['template'], onSelect: () => {} },
      { label: 'Daily log', keywords: ['template'], onSelect: () => {} },
      { label: 'Untagged', onSelect: () => {} },
    ]
    await render(<ProseKitEditor onSlashMenuSearch={onSlashMenuSearch} />)
    await pmRoot.click()
    await userEvent.keyboard('/template')

    await expect.element(menu.getByText('Meeting note')).toBeVisible()
    await expect.element(menu.getByText('Daily log')).toBeVisible()
    await expect.element(menu.getByText('Untagged')).not.toBeVisible()
    expect(menu.element().textContent).not.toContain('template')
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
      { label: 'Meeting note', onSelect: () => ref.current?.insertMarkdown('**Agenda**') },
    ]
    await render(<ProseKitEditor ref={ref} onSlashMenuSearch={onSlashMenuSearch} />)
    await pmRoot.click()
    await userEvent.keyboard('Hello /meet')
    await menu.getByText('Meeting note').click()

    expect(ref.current?.getMarkdown()).toBe('Hello **Agenda**\n')
  })

  it('opens when the insertTrigger command inserts "/"', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} />)
    await pmRoot.click()
    ref.current?.editor?.commands.insertTrigger('/')
    await expect.element(menu).toBeVisible()
    expect(ref.current?.getMarkdown()).toBe('/\n')
  })

  it('prefixes a space when insertTrigger runs right after a word', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} />)
    await pmRoot.click()
    await userEvent.keyboard('Hello')
    ref.current?.editor?.commands.insertTrigger('/')
    await expect.element(menu).toBeVisible()
    expect(ref.current?.getMarkdown()).toBe('Hello /\n')
  })

  it('fits inside a short viewport instead of overflowing it', async () => {
    // Shorter than the popup's natural 25rem, so the positioner's
    // viewport-fitting max-height must constrain it.
    await page.viewport(375, 300)
    try {
      await render(<ProseKitEditor />)
      await pmRoot.click()
      await userEvent.keyboard('/')
      await expect.element(menu).toBeVisible()

      await expect.poll(() => menu.element().getBoundingClientRect().top).toBeGreaterThanOrEqual(0)
      await expect
        .poll(() => menu.element().getBoundingClientRect().bottom)
        .toBeLessThanOrEqual(300)
    } finally {
      await page.viewport(900, 600)
    }
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
    for (const label of [
      'Text',
      'Heading 1',
      'Blockquote',
      'Bullet list',
      'Code block',
      'Math',
      'Table',
    ]) {
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
