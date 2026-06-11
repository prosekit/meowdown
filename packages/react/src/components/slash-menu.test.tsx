import '../testing/index.ts'

import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'

import { ProseKitEditor } from './prosekit-editor.tsx'
import type { EditorHandle } from './types.ts'

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
  'Code block',
  'Table',
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

  it('wraps the current block in a task list', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} />)
    await pmRoot.click()
    await userEvent.keyboard('Buy milk /task')
    await menu.getByText('Task list').click()

    expect(ref.current?.getMarkdown()).toContain('- [ ] Buy milk')
  })
})
