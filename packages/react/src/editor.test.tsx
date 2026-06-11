import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'

import { Editor } from './editor.tsx'
import type { ChangeHandlerOptions } from './types.ts'

function pmRoot(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.ProseMirror')
}

function cmRoot(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.cm-editor')
}

function cmContent(): HTMLElement {
  const content = document.querySelector<HTMLElement>('[data-editor="codemirror"] .cm-content')
  if (!content) throw new Error('CodeMirror content not found')
  return content
}

describe('Editor', () => {
  it('renders a ProseKit editor in focus mode by default', async () => {
    const screen = await render(<Editor initialContent="Hello" />)
    await expect.element(screen.getByText('Hello')).toBeInTheDocument()
    await vi.waitFor(() => {
      expect(pmRoot()?.dataset['markMode']).toBe('focus')
    })
    expect(cmRoot()).toBeNull()
  })

  it('renders a CodeMirror editor in source mode', async () => {
    await render(<Editor mode="source" initialContent="# Hi" />)
    expect(cmRoot()).not.toBeNull()
    expect(pmRoot()).toBeNull()
  })

  it('carries content over from a rich mode to source mode', async () => {
    const screen = await render(<Editor mode="focus" initialContent="# Hello" />)
    await expect.element(screen.getByText('Hello')).toBeInTheDocument()

    await screen.rerender(<Editor mode="source" initialContent="# Hello" />)
    expect(cmContent().textContent).toContain('# Hello')
  })

  it('carries edits over from source mode to a rich mode', async () => {
    const screen = await render(<Editor mode="source" initialContent="# Hello" />)

    await userEvent.click(cmContent())
    await userEvent.keyboard('{End} World')

    await screen.rerender(<Editor mode="focus" initialContent="# Hello" />)
    await expect.element(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('keeps the ProseKit editor instance when switching among rich modes', async () => {
    const screen = await render(<Editor mode="focus" />)

    await userEvent.click(pmRoot()!)
    await userEvent.keyboard('abc')

    await screen.rerender(<Editor mode="show" />)
    await expect.element(screen.getByText('abc')).toBeInTheDocument()
    await vi.waitFor(() => {
      expect(pmRoot()?.dataset['markMode']).toBe('show')
    })
  })

  it('forwards onChange from both editors', async () => {
    const onChange = vi.fn<(options: ChangeHandlerOptions) => void>()
    const screen = await render(<Editor mode="focus" initialContent="Hello" onChange={onChange} />)
    await expect.element(screen.getByText('Hello')).toBeInTheDocument()

    await userEvent.click(pmRoot()!)
    await userEvent.keyboard('1')
    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalled()
    })

    onChange.mockClear()
    await screen.rerender(<Editor mode="source" initialContent="Hello" onChange={onChange} />)

    await userEvent.click(cmContent())
    await userEvent.keyboard('2')
    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalled()
    })
    expect(onChange.mock.calls.at(-1)?.[0].getMarkdown()).toContain('2')
  })
})
