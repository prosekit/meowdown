import '../testing/index.ts'

import { canUseRegexLookbehind } from '@prosekit/core'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'

import { MeowdownEditor } from './editor.tsx'
import { ProseKitEditor } from './prosekit-editor.tsx'
import type { EditorHandle, WikilinkItem } from './types.ts'

const pmRoot = page.locate('.ProseMirror')
const menu = page.getByTestId('wikilink-menu')

const WIKILINKS: WikilinkItem[] = [
  { target: 'Cat naps' },
  { target: 'Meeting notes' },
  { target: 'Reading list' },
]

function searchNotes(query: string): WikilinkItem[] {
  const normalizedQuery = query.toLowerCase()
  return WIKILINKS.filter((item) => item.target.toLowerCase().includes(normalizedQuery))
}

// In `userEvent.keyboard`, a literal `[` is escaped by doubling it.
const TWO_BRACKETS = '[[[['

async function pressInsertShortcut(): Promise<void> {
  await userEvent.keyboard('{ControlOrMeta>}{Shift>}K{/Shift}{/ControlOrMeta}')
}

describe('WikilinkMenu', () => {
  it('opens right after typing "[[" and lists every note', async () => {
    await render(<ProseKitEditor onWikilinkSearch={searchNotes} />)
    await pmRoot.click()
    await expect.element(menu).not.toBeVisible()
    await userEvent.keyboard(TWO_BRACKETS)
    await expect.element(menu).toBeVisible()
    await expect.element(menu.getByText('Cat naps')).toBeVisible()
    await expect.element(menu.getByText('Meeting notes')).toBeVisible()
    await expect.element(menu.getByText('Reading list')).toBeVisible()
  })

  it('filters notes while typing after "[["', async () => {
    await render(<ProseKitEditor onWikilinkSearch={searchNotes} />)
    await pmRoot.click()
    await userEvent.keyboard(`${TWO_BRACKETS}re`)
    await expect.element(menu.getByText('Reading list')).toBeVisible()
    await expect.element(menu.getByText('Cat naps')).not.toBeInTheDocument()
  })

  it('passes the typed wikilink query with casing preserved', async () => {
    const onWikilinkSearch = vi.fn((): WikilinkItem[] => [{ target: 'Project Note' }])
    await render(<ProseKitEditor onWikilinkSearch={onWikilinkSearch} />)
    await pmRoot.click()
    await userEvent.keyboard(`${TWO_BRACKETS}Project Note`)

    await vi.waitFor(() => {
      expect(onWikilinkSearch).toHaveBeenLastCalledWith('Project Note')
    })
  })

  it('passes the typed wikilink query with punctuation preserved', async () => {
    const onWikilinkSearch = vi.fn((): WikilinkItem[] => [{ target: 'C++ Notes' }])
    await render(<ProseKitEditor onWikilinkSearch={onWikilinkSearch} />)
    await pmRoot.click()
    await userEvent.keyboard(`${TWO_BRACKETS}C++ Notes`)

    await vi.waitFor(() => {
      expect(onWikilinkSearch).toHaveBeenLastCalledWith('C++ Notes')
    })
  })

  it('does not open on a single "["', async () => {
    await render(<ProseKitEditor onWikilinkSearch={searchNotes} />)
    await pmRoot.click()
    await userEvent.keyboard('[[x')
    await expect.element(menu).not.toBeVisible()
  })

  it('closes when "]" is typed', async () => {
    await render(<ProseKitEditor onWikilinkSearch={searchNotes} />)
    await pmRoot.click()
    await userEvent.keyboard(`${TWO_BRACKETS}a`)
    await expect.element(menu).toBeVisible()
    await userEvent.keyboard(']')
    await expect.element(menu).not.toBeVisible()
  })

  it('stays open when a space follows "[["', async () => {
    await render(<ProseKitEditor onWikilinkSearch={searchNotes} />)
    await pmRoot.click()
    await userEvent.keyboard(`${TWO_BRACKETS} `)
    await expect.element(menu).toBeVisible()
  })

  it('opens right after typing "@" and lists every note', async () => {
    await render(<ProseKitEditor onWikilinkSearch={searchNotes} />)
    await pmRoot.click()
    await expect.element(menu).not.toBeVisible()
    await userEvent.keyboard('@')
    await expect.element(menu).toBeVisible()
    await expect.element(menu.getByText('Cat naps')).toBeVisible()
    await expect.element(menu.getByText('Meeting notes')).toBeVisible()
    await expect.element(menu.getByText('Reading list')).toBeVisible()
  })

  it('filters notes while typing after "@"', async () => {
    await render(<ProseKitEditor onWikilinkSearch={searchNotes} />)
    await pmRoot.click()
    await userEvent.keyboard('@re')
    await expect.element(menu.getByText('Reading list')).toBeVisible()
    await expect.element(menu.getByText('Cat naps')).not.toBeInTheDocument()
  })

  it('keeps the menu open across spaces for a multi-word query', async () => {
    await render(<ProseKitEditor onWikilinkSearch={searchNotes} />)
    await pmRoot.click()
    await userEvent.keyboard('@cat na')
    await expect.element(menu).toBeVisible()
    await expect.element(menu.getByText('Cat naps')).toBeVisible()
  })

  it('inserts the selected note as [[Name]] and removes the @query', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} onWikilinkSearch={searchNotes} />)
    await pmRoot.click()
    await userEvent.keyboard('Hello @re')
    await menu.getByText('Reading list').click()

    await expect.element(menu).not.toBeVisible()
    expect(ref.current?.getMarkdown()).toContain('Hello [[Reading list]]')
    expect(ref.current?.getMarkdown()).not.toContain('@re')
  })

  it('runs onSelect when a note is chosen', async () => {
    const onSelect = vi.fn()
    const richSearch = (): WikilinkItem[] => [{ target: 'Cat naps', onSelect }]
    await render(<ProseKitEditor onWikilinkSearch={richSearch} />)
    await pmRoot.click()
    await userEvent.keyboard('@cat')
    await menu.getByText('Cat naps').click()
    expect(onSelect).toHaveBeenCalled()
  })

  it('does not open when "@" follows a non-space character', async () => {
    // The fallback regex (no lookbehind support) intentionally triggers mid-word.
    if (!canUseRegexLookbehind()) return
    await render(<ProseKitEditor onWikilinkSearch={searchNotes} />)
    await pmRoot.click()
    await userEvent.keyboard('foo@')
    await expect.element(menu).not.toBeVisible()
  })

  it('does not open when a space follows "@"', async () => {
    await render(<ProseKitEditor onWikilinkSearch={searchNotes} />)
    await pmRoot.click()
    await userEvent.keyboard('text @ text')
    await expect.element(menu).not.toBeVisible()
  })

  it('renders no @ menu when onWikilinkSearch is not given', async () => {
    await render(<ProseKitEditor />)
    await pmRoot.click()
    await userEvent.keyboard('@cat')
    await expect.element(menu).not.toBeInTheDocument()
  })

  it('supports async onWikilinkSearch and shows a loading state', async () => {
    // Deferred promise keeps the pending window deterministic.
    let resolve!: (items: WikilinkItem[]) => void
    const asyncSearch = () =>
      new Promise<WikilinkItem[]>((r) => {
        resolve = r
      })
    await render(<ProseKitEditor onWikilinkSearch={asyncSearch} />)
    await pmRoot.click()
    await userEvent.keyboard(TWO_BRACKETS)
    await expect.element(menu.getByText('Loading...')).toBeVisible()
    resolve([{ target: 'Cat naps' }])
    await expect.element(menu.getByText('Cat naps')).toBeVisible()
  })

  it('shows label and detail, inserts the target, and runs onSelect', async () => {
    const ref = createRef<EditorHandle>()
    const onSelect = vi.fn()
    const richSearch = (): WikilinkItem[] => [
      { target: '2026-06-15', label: 'June 15', detail: 'daily', onSelect },
    ]
    await render(<ProseKitEditor ref={ref} onWikilinkSearch={richSearch} />)
    await pmRoot.click()
    await userEvent.keyboard(TWO_BRACKETS)
    await expect.element(menu.getByText('June 15')).toBeVisible()
    await expect.element(menu.getByText('daily')).toBeVisible()

    await menu.getByText('June 15').click()
    expect(ref.current?.getMarkdown()).toContain('[[2026-06-15]]')
    expect(onSelect).toHaveBeenCalled()
  })

  it('keeps long rows within the menu width', async () => {
    const longTitle = 'A very long note title '.repeat(12)
    const richSearch = (): WikilinkItem[] => [
      {
        target: longTitle,
        label: longTitle,
        detail: 'A very long detail '.repeat(8),
      },
    ]

    await render(<ProseKitEditor onWikilinkSearch={richSearch} />)
    await pmRoot.click()
    await userEvent.keyboard(TWO_BRACKETS)
    await expect.element(menu.getByText(longTitle)).toBeVisible()

    const menuBox = menu.element().getBoundingClientRect()
    const label = menu.getByText(longTitle).element()

    expect(menuBox.width).toBeLessThanOrEqual(384)
    expect(label.scrollWidth).toBeGreaterThan(label.clientWidth)
  })

  it('inserts the selected note as [[Name]] and removes the query', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} onWikilinkSearch={searchNotes} />)
    await pmRoot.click()
    await userEvent.keyboard(`Hello ${TWO_BRACKETS}re`)
    await menu.getByText('Reading list').click()

    await expect.element(menu).not.toBeVisible()
    expect(ref.current?.getMarkdown()).toContain('Hello [[Reading list]]')
    expect(ref.current?.getMarkdown()).not.toContain('[[re')
  })

  it('renders no wikilink menu when onWikilinkSearch is not given', async () => {
    await render(<ProseKitEditor />)
    await pmRoot.click()
    await userEvent.keyboard(TWO_BRACKETS)
    await expect.element(menu).not.toBeInTheDocument()
  })

  it('passes onWikilinkSearch through <MeowdownEditor>', async () => {
    await render(<MeowdownEditor onWikilinkSearch={searchNotes} />)
    await pmRoot.click()
    await userEvent.keyboard(`${TWO_BRACKETS}cat`)
    await expect.element(menu.getByText('Cat naps')).toBeVisible()
  })
})

describe('Mod-Shift-K shortcut', () => {
  it('opens the menu with every note', async () => {
    await render(<ProseKitEditor onWikilinkSearch={searchNotes} />)
    await pmRoot.click()
    await expect.element(menu).not.toBeVisible()
    await pressInsertShortcut()
    await expect.element(menu).toBeVisible()
    await expect.element(menu.getByText('Cat naps')).toBeVisible()
    await expect.element(menu.getByText('Reading list')).toBeVisible()
  })

  it('seeds the query from the selected text', async () => {
    await render(<ProseKitEditor onWikilinkSearch={searchNotes} />)
    await pmRoot.click()
    await userEvent.keyboard('Cat')
    await userEvent.keyboard('{Shift>}{ArrowLeft}{ArrowLeft}{ArrowLeft}{/Shift}')
    await pressInsertShortcut()
    await expect.element(menu.getByText('Cat naps')).toBeVisible()
    await expect.element(menu.getByText('Reading list')).not.toBeInTheDocument()
  })

  it('inserts the selected note as [[Name]] and removes the query', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} onWikilinkSearch={searchNotes} />)
    await pmRoot.click()
    await pressInsertShortcut()
    await menu.getByText('Reading list').click()

    await expect.element(menu).not.toBeVisible()
    expect(ref.current?.getMarkdown()).toContain('[[Reading list]]')
    expect(ref.current?.getMarkdown()).not.toContain('[[\n')
  })

  it('does nothing when onWikilinkSearch is not given', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} />)
    await pmRoot.click()
    await pressInsertShortcut()
    await expect.element(menu).not.toBeInTheDocument()
    expect(ref.current?.getMarkdown()).not.toContain('[[')
  })
})
