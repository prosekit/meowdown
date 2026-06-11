import '../testing/index.ts'

import { createRef, StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'

import { CodeMirrorEditor } from './codemirror-editor.tsx'
import type { EditorHandle } from './types.ts'

const cmEditor = page.locate('[data-editor="codemirror"] .cm-editor')
const cmContent = page.locate('[data-editor="codemirror"] .cm-content')

describe('CodeMirrorEditor', () => {
  it('renders the initial content in a CodeMirror editor', async () => {
    await render(<CodeMirrorEditor initialMarkdown="# Hello CM" />)
    await expect.element(cmEditor).toBeInTheDocument()
    await expect.element(cmContent).toHaveTextContent('# Hello CM')
  })

  it('notifies onDocChange and serializes markdown via the handle', async () => {
    const onDocChange = vi.fn()
    const ref = createRef<EditorHandle>()
    await render(<CodeMirrorEditor ref={ref} initialMarkdown="# Hello" onDocChange={onDocChange} />)

    await cmContent.click()
    await userEvent.keyboard('meow')

    await vi.waitFor(() => {
      expect(onDocChange).toHaveBeenCalled()
    })
    expect(ref.current?.getMarkdown()).toContain('meow')
  })

  it('mounts exactly one editor under StrictMode', async () => {
    await render(
      <StrictMode>
        <CodeMirrorEditor />
      </StrictMode>,
    )
    await expect.element(page.locate('.cm-editor')).toHaveLength(1)
  })

  it('mounts with empty content when no initial content is given', async () => {
    await render(<CodeMirrorEditor />)
    await expect.element(cmContent).toHaveTextContent(/^$/)
  })

  it('replaces the document via setMarkdown and notifies onDocChange', async () => {
    const onDocChange = vi.fn()
    const ref = createRef<EditorHandle>()
    await render(<CodeMirrorEditor ref={ref} initialMarkdown="old" onDocChange={onDocChange} />)
    await expect.element(cmContent).toHaveTextContent('old')

    ref.current?.setMarkdown('# new')
    await expect.element(cmContent).toHaveTextContent('# new')
    expect(ref.current?.getMarkdown()).toBe('# new')
    expect(onDocChange).toHaveBeenCalled()
  })

  it('clamps the selection hint when markdown shrinks the document', async () => {
    const ref = createRef<EditorHandle>()
    await render(<CodeMirrorEditor ref={ref} initialMarkdown="Hello World" />)
    await expect.element(cmContent).toHaveTextContent('Hello World')

    await cmContent.click()
    ref.current?.setState('Hi', { type: 'text', anchor: 11, head: 11 })
    await userEvent.keyboard('!')
    await expect.element(cmContent).toHaveTextContent('Hi!')
    expect(ref.current?.getState()[1]).toMatchObject({ anchor: 3, head: 3 })
  })
})
