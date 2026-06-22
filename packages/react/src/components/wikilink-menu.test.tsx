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
const atMenu = page.getByTestId('wikilink-at-menu')

const WIKILINKS: WikilinkItem[] = [
  { target: 'Cat naps' },
  { target: 'Meeting notes' },
  { target: 'Reading list' },
]

function searchNotes(query: string): WikilinkItem[] {
  return WIKILINKS.filter((item) => item.target.toLowerCase().includes(query))
}

// In `userEvent.keyboard`, a literal `[` is escaped by doubling it.
const TWO_BRACKETS = '[[[['

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

  it('opens right after typing "@" and lists every note', async () => {
    await render(<ProseKitEditor onWikilinkSearch={searchNotes} />)
    await pmRoot.click()
    await expect.element(atMenu).not.toBeVisible()
    await userEvent.keyboard('@')
    await expect.element(atMenu).toBeVisible()
    await expect.element(atMenu.getByText('Cat naps')).toBeVisible()
    await expect.element(atMenu.getByText('Meeting notes')).toBeVisible()
    await expect.element(atMenu.getByText('Reading list')).toBeVisible()
  })

  it('filters notes while typing after "@"', async () => {
    await render(<ProseKitEditor onWikilinkSearch={searchNotes} />)
    await pmRoot.click()
    await userEvent.keyboard('@re')
    await expect.element(atMenu.getByText('Reading list')).toBeVisible()
    await expect.element(atMenu.getByText('Cat naps')).not.toBeInTheDocument()
  })

  it('keeps the menu open across spaces for a multi-word query', async () => {
    await render(<ProseKitEditor onWikilinkSearch={searchNotes} />)
    await pmRoot.click()
    await userEvent.keyboard('@cat na')
    await expect.element(atMenu).toBeVisible()
    await expect.element(atMenu.getByText('Cat naps')).toBeVisible()
  })

  it('inserts the selected note as [[Name]] and removes the @query', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} onWikilinkSearch={searchNotes} />)
    await pmRoot.click()
    await userEvent.keyboard('Hello @re')
    await atMenu.getByText('Reading list').click()

    await expect.element(atMenu).not.toBeVisible()
    expect(ref.current?.getMarkdown()).toContain('Hello [[Reading list]]')
    expect(ref.current?.getMarkdown()).not.toContain('@re')
  })

  it('runs onSelect when a note is chosen', async () => {
    const onSelect = vi.fn()
    const richSearch = (): WikilinkItem[] => [{ target: 'Cat naps', onSelect }]
    await render(<ProseKitEditor onWikilinkSearch={richSearch} />)
    await pmRoot.click()
    await userEvent.keyboard('@cat')
    await atMenu.getByText('Cat naps').click()
    expect(onSelect).toHaveBeenCalled()
  })

  it('does not open when "@" follows a non-space character', async () => {
    // The fallback regex (no lookbehind support) intentionally triggers mid-word.
    if (!canUseRegexLookbehind()) return
    await render(<ProseKitEditor onWikilinkSearch={searchNotes} />)
    await pmRoot.click()
    await userEvent.keyboard('foo@')
    await expect.element(atMenu).not.toBeVisible()
  })

  it('renders no @ menu when onWikilinkSearch is not given', async () => {
    await render(<ProseKitEditor />)
    await pmRoot.click()
    await userEvent.keyboard('@cat')
    await expect.element(atMenu).not.toBeInTheDocument()
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
