import '../testing/index.ts'

import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'

import { Editor } from './editor.tsx'
import type { EditorHandle } from './types.ts'

const pmRoot = page.locate('.ProseMirror')
const cmRoot = page.locate('.cm-editor')
const cmContent = page.locate('[data-editor="codemirror"] .cm-content')

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
})
