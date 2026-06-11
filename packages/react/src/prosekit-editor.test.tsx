import './testing/index.ts'

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
})
