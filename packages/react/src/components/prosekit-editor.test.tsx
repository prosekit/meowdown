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

  it('switches the mark mode when the prop changes', async () => {
    const screen = await render(<ProseKitEditor markMode="hide" initialMarkdown="Hello" />)
    await expect.element(pmRoot).toHaveAttribute('data-mark-mode', 'hide')
    await screen.rerender(<ProseKitEditor markMode="show" initialMarkdown="Hello" />)
    await expect.element(pmRoot).toHaveAttribute('data-mark-mode', 'show')
  })

  it('keeps the mark mode across undo', async () => {
    const screen = await render(<ProseKitEditor markMode="hide" initialMarkdown="Hello" />)
    await expect.element(screen.getByText('Hello')).toBeInTheDocument()

    await pmRoot.click()
    await userEvent.keyboard('abc')
    await screen.rerender(<ProseKitEditor markMode="show" initialMarkdown="Hello" />)
    await expect.element(pmRoot).toHaveAttribute('data-mark-mode', 'show')

    await userEvent.keyboard('{ControlOrMeta>}z{/ControlOrMeta}')
    await expect.element(screen.getByText('Hello')).toBeInTheDocument()
    await expect.element(pmRoot).toHaveAttribute('data-mark-mode', 'show')
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

    await vi.waitFor(() => {
      expect(onDocChange).toHaveBeenCalledTimes(1)
    })
    expect(ref.current?.getMarkdown()).toBe('World!\n')
  })
})
