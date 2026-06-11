import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'

import { ProseKitEditor } from './prosekit-editor.tsx'
import type { ChangeHandlerOptions } from './types.ts'

function pmRoot(): HTMLElement {
  const root = document.querySelector<HTMLElement>('.ProseMirror')
  if (!root) throw new Error('ProseMirror root not found')
  return root
}

describe('ProseKitEditor', () => {
  it('mounts a ProseMirror editor with the default content', async () => {
    const screen = await render(<ProseKitEditor initialContent="Hello World!" />)
    await expect.element(screen.getByText('Hello World!')).toBeInTheDocument()
  })

  it('applies the mark mode', async () => {
    const screen = await render(<ProseKitEditor markMode="hide" initialContent="Hello" />)
    await expect.element(screen.getByText('Hello')).toBeInTheDocument()
    await vi.waitFor(() => {
      expect(pmRoot().dataset['markMode']).toBe('hide')
    })
  })

  it('calls onChange with the serialized markdown', async () => {
    const onChange = vi.fn<(options: ChangeHandlerOptions) => void>()
    const screen = await render(<ProseKitEditor initialContent="# Title" onChange={onChange} />)
    await expect.element(screen.getByText('Title')).toBeInTheDocument()

    await userEvent.click(pmRoot())
    await userEvent.keyboard('abc')

    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalled()
    })
    const markdown = onChange.mock.calls.at(-1)?.[0].getMarkdown() ?? ''
    expect(markdown).toContain('abc')
    expect(markdown.startsWith('# ')).toBe(true)
  })
})
