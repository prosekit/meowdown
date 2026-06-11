import { createRef, StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'

import { CodeMirrorEditor } from './codemirror-editor.tsx'
import type { EditorHandle } from './types.ts'

function cmContent(): HTMLElement {
  const content = document.querySelector<HTMLElement>('[data-editor="codemirror"] .cm-content')
  if (!content) throw new Error('CodeMirror content not found')
  return content
}

describe('CodeMirrorEditor', () => {
  it('renders the initial content in a CodeMirror editor', async () => {
    await render(<CodeMirrorEditor initialMarkdown="# Hello CM" />)
    expect(document.querySelector('[data-editor="codemirror"] .cm-editor')).not.toBeNull()
    expect(cmContent().textContent).toContain('# Hello CM')
  })

  it('notifies onDocChange and serializes markdown via the handle', async () => {
    const onDocChange = vi.fn()
    const ref = createRef<EditorHandle>()
    await render(<CodeMirrorEditor ref={ref} initialMarkdown="# Hello" onDocChange={onDocChange} />)

    await userEvent.click(cmContent())
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
    expect(document.querySelectorAll('.cm-editor').length).toBe(1)
  })

  it('mounts with empty content when no initial content is given', async () => {
    await render(<CodeMirrorEditor />)
    expect(cmContent().textContent).toBe('')
  })
})
