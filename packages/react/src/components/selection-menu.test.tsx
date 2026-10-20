import '../testing/index.ts'

import { sleep } from '@ocavue/utils'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'

import { MarkdownEditor } from './editor.tsx'
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

// Base UI keeps the positioner transparent until it has placed the menu.
function getPlacedMenuRect(): DOMRect {
  const popup = menu.element()
  expect(popup.parentElement && getComputedStyle(popup.parentElement).opacity).toBe('1')
  return popup.getBoundingClientRect()
}

// Paragraphs that wrap across the editor's width: 'line 01 word word ...'.
// Each holds 107 characters, so paragraph `n` (1-based) spans positions
// 109n - 108 .. 109n - 1.
function createParagraphs(count: number): string {
  const words = 'word '.repeat(20).trim()
  return Array.from(
    { length: count },
    (_, i) => `line ${String(i + 1).padStart(2, '0')} ${words}`,
  ).join('\n\n')
}

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
    await sleep(400)
    await expect.element(affordance).not.toBeInTheDocument()
  })

  it('renders nothing when onSelectionMenuSearch is not given', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} initialMarkdown="say hello end" />)
    ref.current?.setSelection(HELLO_SELECTION)
    ref.current?.openSelectionMenu()
    await expect.element(menu).not.toBeInTheDocument()
  })

  it('moves with the selection when the editor scroll container scrolls', async () => {
    const ref = createRef<EditorHandle>()
    await render(
      <div data-testid="scroller" style={{ height: 300, overflowY: 'auto' }}>
        <ProseKitEditor
          ref={ref}
          initialMarkdown={createParagraphs(30)}
          onSelectionMenuSearch={searchItems}
        />
      </div>,
    )
    const scroller = page.getByTestId('scroller')
    const line = pmRoot.element().children[3]
    const getGap = () => getPlacedMenuRect().top - line.getBoundingClientRect().top
    ref.current?.setSelection({ type: 'text', anchor: 328, head: 335 })
    expect(ref.current?.getSelectedText()).toBe('line 04')
    ref.current?.openSelectionMenu()
    await expect.element(menu.getByText('Fix grammar')).toBeVisible()
    await vi.waitFor(() => expect(getGap()).toBeGreaterThan(0))
    const gap = getGap()

    await userEvent.wheel(scroller, { delta: { y: 40 } })
    await vi.waitFor(() => {
      expect(scroller.element().scrollTop).toBeGreaterThan(0)
      expect(getGap()).toBeCloseTo(gap, 0)
    })
  })

  it('passes onSelectionMenuSearch through <MarkdownEditor>', async () => {
    const ref = createRef<EditorHandle>()
    await render(
      <MarkdownEditor
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
