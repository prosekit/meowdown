import '../testing/index.ts'

import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'

import { MeowdownEditor } from './editor.tsx'
import { ProseKitEditor } from './prosekit-editor.tsx'
import type { EditorHandle, SelectionMenuContext, SelectionMenuItem } from './types.ts'

const pmRoot = page.locate('.ProseMirror')
const menu = page.getByTestId('selection-menu')
const affordance = page.getByTestId('selection-menu-affordance')

const ITEMS: SelectionMenuItem[] = [
  { id: 'fix', label: 'Fix grammar', onSelect: () => {} },
  { id: 'summarize', label: 'Summarize', detail: 'Short summary', onSelect: () => {} },
  { id: 'rephrase', label: 'Rephrase', onSelect: () => {} },
]

function searchItems(query: string): SelectionMenuItem[] {
  return ITEMS.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
}

// The doc is one paragraph 'say hello end'; 'hello' spans positions 5..10.
const HELLO_SELECTION = { type: 'text', anchor: 5, head: 10 } as const

describe('SelectionMenu', () => {
  it('opens over a selection via the handle and lists the items', async () => {
    const ref = createRef<EditorHandle>()
    await render(
      <ProseKitEditor
        ref={ref}
        initialMarkdown="say hello end"
        onSelectionMenuSearch={searchItems}
      />,
    )
    ref.current?.setSelection(HELLO_SELECTION)
    await expect.element(menu).not.toBeInTheDocument()

    ref.current?.openSelectionMenu()
    await expect.element(menu).toBeVisible()
    await expect.element(menu.getByText('Fix grammar')).toBeVisible()
    await expect.element(menu.getByText('Short summary')).toBeVisible()
  })

  it('stays closed when the selection is empty', async () => {
    const ref = createRef<EditorHandle>()
    await render(
      <ProseKitEditor
        ref={ref}
        initialMarkdown="say hello end"
        onSelectionMenuSearch={searchItems}
      />,
    )
    ref.current?.setSelection({ type: 'text', anchor: 3, head: 3 })
    ref.current?.openSelectionMenu()
    await expect.element(menu).not.toBeInTheDocument()
  })

  it('passes the filter text and the selection to the search handler', async () => {
    const ref = createRef<EditorHandle>()
    const search = vi.fn((query: string, _context: SelectionMenuContext) => searchItems(query))
    await render(
      <ProseKitEditor ref={ref} initialMarkdown="say hello end" onSelectionMenuSearch={search} />,
    )
    ref.current?.setSelection(HELLO_SELECTION)
    ref.current?.openSelectionMenu()
    await expect.element(menu).toBeVisible()

    await userEvent.keyboard('sum')
    await expect.element(menu.getByText('Summarize')).toBeVisible()
    await expect.element(menu.getByText('Fix grammar')).not.toBeInTheDocument()

    const lastCall = search.mock.calls.at(-1)
    expect(lastCall?.[0]).toBe('sum')
    expect(lastCall?.[1]).toEqual({ selectedText: 'hello', from: 5, to: 10 })
  })

  it('Enter picks the active item with the captured selection and closes', async () => {
    const ref = createRef<EditorHandle>()
    const onSelect = vi.fn()
    const search = (): SelectionMenuItem[] => [{ id: 'fix', label: 'Fix grammar', onSelect }]
    await render(
      <ProseKitEditor ref={ref} initialMarkdown="say hello end" onSelectionMenuSearch={search} />,
    )
    ref.current?.setSelection(HELLO_SELECTION)
    ref.current?.openSelectionMenu()
    await expect.element(menu.getByText('Fix grammar')).toBeVisible()

    await userEvent.keyboard('{Enter}')
    await expect.element(menu).not.toBeInTheDocument()
    expect(onSelect).toHaveBeenCalledWith({ selectedText: 'hello', from: 5, to: 10 })
  })

  it('shows the affordance on a selection and opens the menu from it', async () => {
    const ref = createRef<EditorHandle>()
    await render(
      <ProseKitEditor
        ref={ref}
        initialMarkdown="say hello end"
        onSelectionMenuSearch={searchItems}
      />,
    )
    await expect.element(affordance).not.toBeInTheDocument()
    await pmRoot.click()
    ref.current?.setSelection(HELLO_SELECTION)
    await expect.element(affordance).toBeVisible()

    await affordance.getByRole('button', { name: 'Selection commands' }).click()
    await expect.element(menu).toBeVisible()
    await expect.element(affordance).not.toBeInTheDocument()
  })

  it('hides the affordance when selectionMenuAffordance is off', async () => {
    const ref = createRef<EditorHandle>()
    await render(
      <ProseKitEditor
        ref={ref}
        initialMarkdown="say hello end"
        onSelectionMenuSearch={searchItems}
        selectionMenuAffordance={false}
      />,
    )
    await pmRoot.click()
    ref.current?.setSelection(HELLO_SELECTION)
    // Give the (absent) affordance delay a chance to elapse.
    await new Promise((resolve) => setTimeout(resolve, 400))
    await expect.element(affordance).not.toBeInTheDocument()
  })

  it('renders nothing when onSelectionMenuSearch is not given', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} initialMarkdown="say hello end" />)
    ref.current?.setSelection(HELLO_SELECTION)
    ref.current?.openSelectionMenu()
    await expect.element(menu).not.toBeInTheDocument()
  })

  it('passes onSelectionMenuSearch through <MeowdownEditor>', async () => {
    const ref = createRef<EditorHandle>()
    await render(
      <MeowdownEditor
        handleRef={ref}
        initialMarkdown="say hello end"
        onSelectionMenuSearch={searchItems}
      />,
    )
    ref.current?.setSelection(HELLO_SELECTION)
    ref.current?.openSelectionMenu()
    await expect.element(menu.getByText('Fix grammar')).toBeVisible()
    expect(ref.current?.getSelectedText()).toBe('hello')
  })
})
