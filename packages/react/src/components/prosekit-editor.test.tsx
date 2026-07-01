import '../testing/index.ts'

import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'

import { ProseKitEditor } from './prosekit-editor.tsx'
import type { EditorHandle } from './types.ts'

const pmRoot = page.locate('.ProseMirror')

describe('ProseKitEditor', () => {
  it('mounts a ProseMirror editor with the default content', async () => {
    const screen = await render(<ProseKitEditor initialMarkdown="Hello World!" />)
    await expect.element(screen.getByText('Hello World!')).toBeInTheDocument()
  })

  it('applies the mark mode', async () => {
    const screen = await render(<ProseKitEditor markMode="hide" initialMarkdown="Hello" />)
    await expect.element(screen.getByText('Hello')).toBeInTheDocument()
    await expect.element(pmRoot).toHaveAttribute('data-mark-mode', 'hide')
  })

  it('notifies onDocChange and serializes markdown via the handle', async () => {
    const onDocChange = vi.fn()
    const ref = createRef<EditorHandle>()
    const screen = await render(
      <ProseKitEditor ref={ref} initialMarkdown="# Title" onDocChange={onDocChange} />,
    )
    await expect.element(screen.getByText('Title')).toBeInTheDocument()

    await pmRoot.click()
    await userEvent.keyboard('abc')

    await vi.waitFor(() => {
      expect(onDocChange).toHaveBeenCalled()
    })
    const markdown = ref.current?.getMarkdown() ?? ''
    expect(markdown).toContain('abc')
    expect(markdown.startsWith('# ')).toBe(true)
  })

  it('round-trips a node selection through getState and setState', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<ProseKitEditor ref={ref} initialMarkdown="Hello" />)
    await expect.element(screen.getByText('Hello')).toBeInTheDocument()

    ref.current?.setState(undefined, { type: 'node', anchor: 0, head: 0 })
    await expect.element(page.locate('.ProseMirror-selectednode')).toBeInTheDocument()
    const state = ref.current?.getState()
    expect(state?.[1].type).toBe('node')

    ref.current?.setState(state?.[0], state?.[1])
    expect(ref.current?.getState()[1].type).toBe('node')
  })

  it('falls back to a text selection for an invalid selection hint', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<ProseKitEditor ref={ref} initialMarkdown="Hello" />)
    await expect.element(screen.getByText('Hello')).toBeInTheDocument()

    ref.current?.setState(undefined, { type: 'bogus', anchor: 1, head: 3 })
    expect(ref.current?.getState()[1]).toMatchObject({ type: 'text', anchor: 1, head: 3 })
  })

  it('keeps undo history across setMarkdown', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<ProseKitEditor ref={ref} initialMarkdown="Hello" />)
    await expect.element(screen.getByText('Hello')).toBeInTheDocument()

    ref.current?.setMarkdown('World')
    await expect.element(screen.getByText('World')).toBeInTheDocument()

    await pmRoot.click()
    await userEvent.keyboard('{ControlOrMeta>}z{/ControlOrMeta}')
    await expect.element(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('inserts a lone-paragraph fragment inline at the cursor', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<ProseKitEditor ref={ref} initialMarkdown="Hello world" />)
    await expect.element(screen.getByText('Hello world')).toBeInTheDocument()

    // Cursor after "Hello ".
    ref.current?.setSelection({ type: 'text', anchor: 7, head: 7 })
    ref.current?.insertMarkdown('brave **new** ')

    expect(ref.current?.getMarkdown()).toBe('Hello brave **new** world\n')
    // The cursor lands at the end of the inserted text.
    expect(ref.current?.getSelection()).toMatchObject({ type: 'text', anchor: 21, head: 21 })
  })

  it('replaces the current selection with the inserted fragment', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<ProseKitEditor ref={ref} initialMarkdown="Hello world" />)
    await expect.element(screen.getByText('Hello world')).toBeInTheDocument()

    // "Hello" is selected.
    ref.current?.setSelection({ type: 'text', anchor: 1, head: 6 })
    ref.current?.insertMarkdown('Goodbye')

    expect(ref.current?.getMarkdown()).toBe('Goodbye world\n')
  })

  it('inserts a multi-block fragment as blocks with the cursor at its end', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<ProseKitEditor ref={ref} initialMarkdown={'Hello\n\nWorld'} />)
    await expect.element(screen.getByText('Hello')).toBeInTheDocument()

    // Cursor at the end of "Hello".
    ref.current?.setSelection({ type: 'text', anchor: 6, head: 6 })
    ref.current?.insertMarkdown('# Title\n\n- item')
    expect(ref.current?.getMarkdown()).toBe('Hello\n\n# Title\n\n- item\n\nWorld\n')

    // Typing continues at the end of the inserted content.
    ref.current?.focus()
    await userEvent.keyboard('!')
    expect(ref.current?.getMarkdown()).toBe('Hello\n\n# Title\n\n- item!\n\nWorld\n')
  })

  it('undoes an inserted fragment as a single history entry', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<ProseKitEditor ref={ref} initialMarkdown="Hello" />)
    await expect.element(screen.getByText('Hello')).toBeInTheDocument()

    ref.current?.setSelection('end')
    ref.current?.insertMarkdown('# Title\n\n- item')
    await expect.element(screen.getByText('Title')).toBeInTheDocument()

    await pmRoot.click()
    await userEvent.keyboard('{ControlOrMeta>}z{/ControlOrMeta}')
    expect(ref.current?.getMarkdown()).toBe('Hello\n')
  })

  it('ignores an empty or whitespace-only fragment', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<ProseKitEditor ref={ref} initialMarkdown="Hello" />)
    await expect.element(screen.getByText('Hello')).toBeInTheDocument()

    ref.current?.insertMarkdown('')
    ref.current?.insertMarkdown('  \n\t ')
    expect(ref.current?.getMarkdown()).toBe('Hello\n')
  })

  it('fires onDocChange for insertMarkdown, unlike setMarkdown', async () => {
    const onDocChange = vi.fn()
    const ref = createRef<EditorHandle>()
    const screen = await render(
      <ProseKitEditor ref={ref} initialMarkdown="Hello" onDocChange={onDocChange} />,
    )
    await expect.element(screen.getByText('Hello')).toBeInTheDocument()

    ref.current?.setMarkdown('World')
    ref.current?.setSelection('end')
    ref.current?.insertMarkdown('!')

    // Only the insert fires: the host already knows the setMarkdown content.
    await vi.waitFor(() => {
      expect(onDocChange).toHaveBeenCalledTimes(1)
    })
    expect(ref.current?.getMarkdown()).toBe('World!\n')
  })
})
