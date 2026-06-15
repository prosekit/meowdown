import '../testing/index.ts'

import { useEditor } from '@prosekit/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'

import { Editor } from './editor.tsx'
import type { EditorHandle } from './types.ts'

const pmRoot = page.locate('.ProseMirror')
const cmRoot = page.locate('.cm-editor')
const cmContent = page.locate('[data-editor="codemirror"] .cm-content')

// Renders only when it sits inside the editor's ProseKit context; `useEditor`
// throws otherwise.
function EditorProbe() {
  const editor = useEditor()
  return <span data-testid="probe">{editor ? 'has-editor' : 'no-editor'}</span>
}

describe('Editor', () => {
  it('renders a ProseKit editor in focus mode by default', async () => {
    const screen = await render(<Editor initialMarkdown="Hello" />)
    await expect.element(screen.getByText('Hello')).toBeInTheDocument()
    await expect.element(pmRoot).toHaveAttribute('data-mark-mode', 'focus')
    await expect.element(cmRoot).not.toBeInTheDocument()
  })

  it('renders a CodeMirror editor in source mode', async () => {
    await render(<Editor mode="source" initialMarkdown="# Hi" />)
    await expect.element(cmRoot).toBeInTheDocument()
    await expect.element(pmRoot).not.toBeInTheDocument()
  })

  it('carries content over from a rich mode to source mode', async () => {
    const screen = await render(<Editor mode="focus" initialMarkdown="# Hello" />)
    await expect.element(screen.getByText('Hello')).toBeInTheDocument()

    await screen.rerender(<Editor mode="source" initialMarkdown="# Hello" />)
    await expect.element(cmContent).toHaveTextContent('# Hello')
  })

  it('carries edits over from source mode to a rich mode', async () => {
    const screen = await render(<Editor mode="source" initialMarkdown="# Hello" />)

    await cmContent.click()
    await userEvent.keyboard('{End} World')

    await screen.rerender(<Editor mode="focus" initialMarkdown="# Hello" />)
    await expect.element(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('keeps the ProseKit editor instance when switching among rich modes', async () => {
    const screen = await render(<Editor mode="focus" />)

    await pmRoot.click()
    await userEvent.keyboard('abc')

    await screen.rerender(<Editor mode="show" />)
    await expect.element(screen.getByText('abc')).toBeInTheDocument()
    await expect.element(pmRoot).toHaveAttribute('data-mark-mode', 'show')
  })

  it('notifies onDocChange and exposes markdown via ref in both editors', async () => {
    const onDocChange = vi.fn()
    const ref = createRef<EditorHandle>()
    const screen = await render(
      <Editor ref={ref} mode="focus" initialMarkdown="Hello" onDocChange={onDocChange} />,
    )
    await expect.element(screen.getByText('Hello')).toBeInTheDocument()
    expect(ref.current?.getMarkdown()).toBe('Hello\n')

    await pmRoot.click()
    await userEvent.keyboard('1')
    await vi.waitFor(() => {
      expect(onDocChange).toHaveBeenCalled()
    })
    expect(ref.current?.getMarkdown()).toContain('1')

    onDocChange.mockClear()
    await screen.rerender(
      <Editor ref={ref} mode="source" initialMarkdown="Hello" onDocChange={onDocChange} />,
    )

    await cmContent.click()
    await userEvent.keyboard('2')
    await vi.waitFor(() => {
      expect(onDocChange).toHaveBeenCalled()
    })
    expect(ref.current?.getMarkdown()).toContain('2')
  })

  it('replaces content via setMarkdown in both editors', async () => {
    const onDocChange = vi.fn()
    const ref = createRef<EditorHandle>()
    const screen = await render(
      <Editor ref={ref} initialMarkdown="Old text" onDocChange={onDocChange} />,
    )
    await expect.element(screen.getByText('Old text')).toBeInTheDocument()

    ref.current?.setMarkdown('# New title')
    await expect.element(screen.getByText('New title')).toBeInTheDocument()
    expect(ref.current?.getMarkdown()).toBe('# New title\n')
    expect(onDocChange).toHaveBeenCalled()

    await screen.rerender(
      <Editor ref={ref} mode="source" initialMarkdown="Old text" onDocChange={onDocChange} />,
    )
    ref.current?.setMarkdown('plain')
    await expect.element(cmContent).toHaveTextContent('plain')
    expect(ref.current?.getMarkdown()).toBe('plain')
  })

  it('reports the document and selection via getState', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<Editor ref={ref} initialMarkdown="Hello" />)
    await expect.element(screen.getByText('Hello')).toBeInTheDocument()

    await pmRoot.click()
    await userEvent.keyboard('{End}')
    const [markdown, selection] = ref.current?.getState() ?? ['', null]
    expect(markdown).toBe('Hello\n')
    expect(selection).toMatchObject({ type: 'text', anchor: 6, head: 6 })
  })

  it('applies markdown and a selection hint via setState', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<Editor ref={ref} initialMarkdown="x" />)
    await expect.element(screen.getByText('x')).toBeInTheDocument()

    await pmRoot.click()
    ref.current?.setState('ac', { type: 'text', anchor: 2, head: 2 })
    await expect.element(screen.getByText('ac')).toBeInTheDocument()

    await userEvent.keyboard('b')
    await expect.element(screen.getByText('abc')).toBeInTheDocument()
  })

  it('moves the cursor via a selection-only setState', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<Editor ref={ref} initialMarkdown="ac" />)
    await expect.element(screen.getByText('ac')).toBeInTheDocument()

    await pmRoot.click()
    ref.current?.setState(undefined, { type: 'text', anchor: 2, head: 2 })
    await userEvent.keyboard('b')
    await expect.element(screen.getByText('abc')).toBeInTheDocument()
    expect(ref.current?.getMarkdown()).toBe('abc\n')
  })

  it('reads and writes the selection via getSelection and setSelection', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<Editor ref={ref} initialMarkdown="ac" />)
    await expect.element(screen.getByText('ac')).toBeInTheDocument()

    await pmRoot.click()
    ref.current?.setSelection({ type: 'text', anchor: 2, head: 2 })
    expect(ref.current?.getSelection()).toMatchObject({ type: 'text', anchor: 2, head: 2 })

    await userEvent.keyboard('b')
    await expect.element(screen.getByText('abc')).toBeInTheDocument()
  })

  it('supports start and end selection hints', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<Editor ref={ref} initialMarkdown="Hi" />)
    await expect.element(screen.getByText('Hi')).toBeInTheDocument()

    await pmRoot.click()
    ref.current?.setState(undefined, 'end')
    await userEvent.keyboard('!')
    await expect.element(screen.getByText('Hi!')).toBeInTheDocument()

    ref.current?.setState(undefined, 'start')
    await userEvent.keyboard('A')
    await expect.element(screen.getByText('AHi!')).toBeInTheDocument()
  })

  it('clamps out-of-range selection hints without throwing', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<Editor ref={ref} initialMarkdown="Hi" />)
    await expect.element(screen.getByText('Hi')).toBeInTheDocument()

    await pmRoot.click()
    ref.current?.setState(undefined, { type: 'text', anchor: 9999, head: 9999 })
    await userEvent.keyboard('!')
    await expect.element(screen.getByText('Hi!')).toBeInTheDocument()

    ref.current?.setState(undefined, { type: 'text', anchor: -5, head: -5 })
    await userEvent.keyboard('A')
    await expect.element(screen.getByText('AHi!')).toBeInTheDocument()
  })

  it('round-trips the editor state through getState and setState', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<Editor ref={ref} initialMarkdown="# Title" />)
    await expect.element(screen.getByText('Title')).toBeInTheDocument()

    const state = ref.current?.getState()
    ref.current?.setState(state?.[0], state?.[1])
    expect(ref.current?.getMarkdown()).toBe('# Title\n')
    expect(ref.current?.getState()).toEqual(state)
  })

  it('applies setState in source mode', async () => {
    const ref = createRef<EditorHandle>()
    await render(<Editor ref={ref} mode="source" initialMarkdown="Hello World" />)
    await expect.element(cmContent).toHaveTextContent('Hello World')

    await cmContent.click()
    ref.current?.setState('Hi', { type: 'text', anchor: 999, head: 999 })
    await expect.element(cmContent).toHaveTextContent('Hi')
    await userEvent.keyboard('!')
    await expect.element(cmContent).toHaveTextContent('Hi!')
  })

  it('exposes the underlying editor on the handle in rich modes only', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<Editor ref={ref} initialMarkdown="Hi" />)
    await expect.element(screen.getByText('Hi')).toBeInTheDocument()
    expect(ref.current?.editor).toBeTruthy()
    expect(ref.current?.editor?.state.doc.textContent).toBe('Hi')

    await screen.rerender(<Editor ref={ref} mode="source" initialMarkdown="Hi" />)
    expect(ref.current?.editor).toBeUndefined()
  })

  it('applies editorClassName and wrapperClassName', async () => {
    await render(
      <Editor initialMarkdown="Hi" editorClassName="test-editable" wrapperClassName="test-wrap" />,
    )
    await expect.element(pmRoot).toHaveClass('test-editable')
    await expect.element(page.locate('.test-wrap')).toBeInTheDocument()
  })

  it('renders children inside the ProseKit context in rich modes', async () => {
    await render(
      <Editor initialMarkdown="Hi">
        <EditorProbe />
      </Editor>,
    )
    await expect.element(page.getByTestId('probe')).toHaveTextContent('has-editor')
  })

  it('does not render children in source mode', async () => {
    await render(
      <Editor mode="source" initialMarkdown="Hi">
        <EditorProbe />
      </Editor>,
    )
    await expect.element(cmRoot).toBeInTheDocument()
    await expect.element(page.getByTestId('probe')).not.toBeInTheDocument()
  })

  it('focuses and scrolls via the handle in both editors', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<Editor ref={ref} initialMarkdown="Hi" />)
    await expect.element(screen.getByText('Hi')).toBeInTheDocument()

    ref.current?.focus()
    ref.current?.scrollIntoView()
    await userEvent.keyboard('!')
    await expect.element(screen.getByText('!Hi')).toBeInTheDocument()

    await screen.rerender(<Editor ref={ref} mode="source" initialMarkdown="Hi" />)
    ref.current?.focus()
    ref.current?.scrollIntoView()
    await userEvent.keyboard('A')
    await expect.element(cmContent).toHaveTextContent('A!Hi')
  })
})
