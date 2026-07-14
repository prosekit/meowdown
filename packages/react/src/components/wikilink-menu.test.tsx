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

  it('maps an asynchronously resolved target through an edit before the link', async () => {
    const ref = createRef<EditorHandle>()
    let resolveTarget!: (target: string | null) => void
    const richSearch = (): WikilinkItem[] => [
      {
        target: 'Jane Smith',
        resolveTarget: () =>
          new Promise((resolve) => {
            resolveTarget = resolve
          }),
      },
    ]
    await render(<ProseKitEditor ref={ref} onWikilinkSearch={richSearch} />)
    await pmRoot.click()
    await userEvent.keyboard('Hello @jane')
    await menu.getByText('Jane Smith').click()

    expect(ref.current?.getMarkdown()).toContain('Hello [[Jane Smith]]')
    ref.current?.setSelection('start')
    ref.current?.insertMarkdown('!')
    resolveTarget('Jane Doe')

    await vi.waitFor(() => {
      expect(ref.current?.getMarkdown()).toContain('!Hello [[Jane Doe]]')
    })
  })

  it('maps other pending links when an earlier target settles first', async () => {
    const ref = createRef<EditorHandle>()
    const resolvers = new Map<string, (target: string | null) => void>()
    const richSearch = (query: string): WikilinkItem[] => {
      const target = query.toLowerCase().startsWith('jane') ? 'Jane Smith' : 'Ada Lovelace'
      return [
        {
          target,
          resolveTarget: () =>
            new Promise((resolve) => {
              resolvers.set(target, resolve)
            }),
        },
      ]
    }
    await render(<ProseKitEditor ref={ref} onWikilinkSearch={richSearch} />)
    await pmRoot.click()
    await userEvent.keyboard('@jane')
    await menu.getByText('Jane Smith').click()
    await userEvent.keyboard(' and @ada')
    await menu.getByText('Ada Lovelace').click()

    resolvers.get('Jane Smith')?.('Jane Alexandra Doe')
    await vi.waitFor(() => {
      expect(ref.current?.getMarkdown()).toContain('[[Jane Alexandra Doe]] and [[Ada Lovelace]]')
    })
    resolvers.get('Ada Lovelace')?.('Ada Byron')

    await vi.waitFor(() => {
      expect(ref.current?.getMarkdown()).toContain('[[Jane Alexandra Doe]] and [[Ada Byron]]')
    })
  })

  it('removes only the provisional link when target resolution returns null', async () => {
    const ref = createRef<EditorHandle>()
    let resolveTarget!: (target: string | null) => void
    const richSearch = (): WikilinkItem[] => [
      {
        target: 'Jane Smith',
        resolveTarget: () =>
          new Promise((resolve) => {
            resolveTarget = resolve
          }),
      },
    ]
    await render(<ProseKitEditor ref={ref} onWikilinkSearch={richSearch} />)
    await pmRoot.click()
    await userEvent.keyboard('Hello @jane')
    await menu.getByText('Jane Smith').click()
    ref.current?.insertMarkdown('!')

    resolveTarget(null)

    await vi.waitFor(() => {
      expect(ref.current?.getMarkdown()).toContain('Hello !')
      expect(ref.current?.getMarkdown()).not.toContain('Jane Smith')
    })
  })

  it('does not overwrite the document after the provisional link is edited away', async () => {
    const ref = createRef<EditorHandle>()
    let resolveTarget!: (target: string | null) => void
    const richSearch = (): WikilinkItem[] => [
      {
        target: 'Jane Smith',
        resolveTarget: () =>
          new Promise((resolve) => {
            resolveTarget = resolve
          }),
      },
    ]
    await render(<ProseKitEditor ref={ref} onWikilinkSearch={richSearch} />)
    await pmRoot.click()
    await userEvent.keyboard('@jane')
    await menu.getByText('Jane Smith').click()

    ref.current?.setMarkdown('User edit')
    resolveTarget('Jane Doe')
    await new Promise<void>((resolve) => queueMicrotask(resolve))

    expect(ref.current?.getMarkdown()).toBe('User edit\n')
  })

  it('keeps the provisional link when target resolution rejects', async () => {
    const ref = createRef<EditorHandle>()
    let rejectTarget!: (reason: Error) => void
    const richSearch = (): WikilinkItem[] => [
      {
        target: 'Jane Smith',
        resolveTarget: () =>
          new Promise((_resolve, reject) => {
            rejectTarget = reject
          }),
      },
    ]
    await render(<ProseKitEditor ref={ref} onWikilinkSearch={richSearch} />)
    await pmRoot.click()
    await userEvent.keyboard('@jane')
    await menu.getByText('Jane Smith').click()

    rejectTarget(new Error('lookup failed'))
    await new Promise<void>((resolve) => queueMicrotask(resolve))

    expect(ref.current?.getMarkdown()).toContain('[[Jane Smith]]')
  })

  it('keeps asynchronous target correction out of undo history', async () => {
    const ref = createRef<EditorHandle>()
    let resolveTarget!: (target: string | null) => void
    const richSearch = (): WikilinkItem[] => [
      {
        target: 'Jane Smith',
        resolveTarget: () =>
          new Promise((resolve) => {
            resolveTarget = resolve
          }),
      },
    ]
    await render(<ProseKitEditor ref={ref} onWikilinkSearch={richSearch} />)
    await pmRoot.click()
    await userEvent.keyboard('@jane')
    await menu.getByText('Jane Smith').click()
    await new Promise<void>((resolve) => setTimeout(resolve, 600))

    resolveTarget('Jane Doe')
    await vi.waitFor(() => {
      expect(ref.current?.getMarkdown()).toContain('[[Jane Doe]]')
    })
    await userEvent.keyboard('{ControlOrMeta>}z{/ControlOrMeta}')

    expect(ref.current?.getMarkdown()).not.toContain('Jane Doe')
    expect(ref.current?.getMarkdown()).not.toContain('Jane Smith')
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

  it('extends the query over existing text with ArrowRight', async () => {
    const ref = createRef<EditorHandle>()
    const onWikilinkSearch = vi.fn(searchNotes)
    await render(
      <ProseKitEditor
        ref={ref}
        initialMarkdown="See Reading list today"
        onWikilinkSearch={onWikilinkSearch}
      />,
    )
    ref.current?.setSelection({ type: 'text', anchor: 5, head: 5 })
    ref.current?.focus()

    await userEvent.keyboard(TWO_BRACKETS)
    await userEvent.keyboard('{ArrowRight}'.repeat('Reading list'.length))

    await vi.waitFor(() => {
      expect(onWikilinkSearch).toHaveBeenLastCalledWith('Reading list')
    })
    await expect.element(menu.getByText('Reading list')).toBeVisible()

    await menu.getByText('Reading list').click()
    expect(ref.current?.getMarkdown()).toBe('See [[Reading list]] today\n')
  })

  it('can create a wikilink from existing text included with ArrowRight', async () => {
    const ref = createRef<EditorHandle>()
    const onSelect = vi.fn()
    const onWikilinkSearch = vi.fn((query: string): WikilinkItem[] => {
      return query ? [{ target: query, label: `Create "${query}"`, onSelect }] : []
    })
    await render(
      <ProseKitEditor
        ref={ref}
        initialMarkdown="See New project later"
        onWikilinkSearch={onWikilinkSearch}
      />,
    )
    ref.current?.setSelection({ type: 'text', anchor: 5, head: 5 })
    ref.current?.focus()

    await userEvent.keyboard(TWO_BRACKETS)
    await userEvent.keyboard('{ArrowRight}'.repeat('New project'.length))

    const createItem = menu.getByText('Create "New project"')
    await expect.element(createItem).toBeVisible()
    await createItem.click()

    expect(ref.current?.getMarkdown()).toBe('See [[New project]] later\n')
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('does not reopen a dismissed query when ArrowRight crosses existing text', async () => {
    const ref = createRef<EditorHandle>()
    await render(
      <ProseKitEditor ref={ref} initialMarkdown="See Cat" onWikilinkSearch={searchNotes} />,
    )
    ref.current?.setSelection({ type: 'text', anchor: 5, head: 5 })
    ref.current?.focus()

    await userEvent.keyboard(TWO_BRACKETS)
    await expect.element(menu).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await userEvent.keyboard('{ArrowRight}')

    await expect.element(menu).not.toBeVisible()
    expect(ref.current?.getSelection()).toMatchObject({ anchor: 8, head: 8 })
  })

  it('extends instead of closing when the cursor moves programmatically', async () => {
    const ref = createRef<EditorHandle>()
    const onWikilinkSearch = vi.fn(searchNotes)
    await render(
      <ProseKitEditor ref={ref} initialMarkdown="See Cat" onWikilinkSearch={onWikilinkSearch} />,
    )
    ref.current?.setSelection({ type: 'text', anchor: 5, head: 5 })
    ref.current?.focus()

    await userEvent.keyboard(TWO_BRACKETS)
    await expect.element(menu).toBeVisible()
    ref.current?.setSelection({ type: 'text', anchor: 10, head: 10 })

    await vi.waitFor(() => {
      expect(onWikilinkSearch).toHaveBeenLastCalledWith('Cat')
    })
    await expect.element(menu).toBeVisible()
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

describe('"[" over a selection', () => {
  it('wraps the selection and opens the menu with it as the query', async () => {
    await render(<ProseKitEditor onWikilinkSearch={searchNotes} />)
    await pmRoot.click()
    await userEvent.keyboard('Cat')
    await userEvent.keyboard('{Shift>}{ArrowLeft}{ArrowLeft}{ArrowLeft}{/Shift}')
    await userEvent.keyboard('[[')
    await expect.element(menu).toBeVisible()
    await expect.element(menu.getByText('Cat naps')).toBeVisible()
    await expect.element(menu.getByText('Reading list')).not.toBeInTheDocument()
  })

  it('types a literal bracket when nothing is selected', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} onWikilinkSearch={searchNotes} />)
    await pmRoot.click()
    await userEvent.keyboard('Cat [[')
    await expect.element(menu).not.toBeVisible()
    expect(ref.current?.getMarkdown()).toContain('Cat [')
  })
})

describe('Escape', () => {
  it('closes an open menu and keeps the typed text', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} onWikilinkSearch={searchNotes} />)
    await pmRoot.click()
    await userEvent.keyboard(`${TWO_BRACKETS}Cat`)
    await expect.element(menu).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await expect.element(menu).not.toBeVisible()
    expect(ref.current?.getMarkdown()).toContain('[[Cat')
  })

  it('collapses a plain selection when no menu is open', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} onWikilinkSearch={searchNotes} />)
    await pmRoot.click()
    await userEvent.keyboard('Cat')
    await userEvent.keyboard('{Shift>}{ArrowLeft}{ArrowLeft}{ArrowLeft}{/Shift}')
    await userEvent.keyboard('{Escape}')
    const selection = ref.current?.getSelection()
    expect(selection?.anchor).toBe(selection?.head)
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

  it('seeds the query from the visible text of a formatted selection', async () => {
    const ref = createRef<EditorHandle>()
    const onWikilinkSearch = vi.fn(searchNotes)
    await render(
      <ProseKitEditor
        ref={ref}
        initialMarkdown="**Cat naps**"
        onWikilinkSearch={onWikilinkSearch}
      />,
    )
    ref.current?.setSelection({ type: 'text', anchor: 1, head: 13 })
    ref.current?.focus()

    await pressInsertShortcut()

    await vi.waitFor(() => {
      expect(onWikilinkSearch).toHaveBeenLastCalledWith('Cat naps')
    })
    await menu.getByText('Cat naps').click()
    expect(ref.current?.getMarkdown()).toBe('[[Cat naps]]\n')
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
