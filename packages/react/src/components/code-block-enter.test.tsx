import '../testing/index.ts'

import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'

import { ProseKitEditor } from './prosekit-editor.tsx'
import type { EditorHandle } from './types.ts'

const pmRoot = page.locate('.ProseMirror')
const codeText = pmRoot.locate('pre code')
const tokens = codeText.locate('[class*="tok-"]')
const rogueBreak = pmRoot.locate('br:not(.ProseMirror-trailingBreak)')

const CODE_BLOCK_MD = '```js\nfoobar\n```'

// In the `react-webkit-ios` project this file runs with an iPhone Safari user
// agent, where prosemirror-view hands every plain Enter in a code block to
// WebKit's native editing; in the regular project the same gestures pin the
// desktop behavior. Every step is a user gesture: click, arrow keys, Enter.
describe('enter inside a code block', () => {
  async function setupCodeBlockEditor() {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} initialMarkdown={CODE_BLOCK_MD} />)
    // The corruption only takes its production shape once highlight token
    // spans wrap the code text.
    await expect.element(tokens.first(), { timeout: 15000 }).toBeInTheDocument()
    return ref
  }

  // Click into the code text, then walk left to the line start: six presses
  // cover every caret position `foobar` allows.
  async function moveCaretToCodeStart() {
    await codeText.click()
    await userEvent.keyboard('{ArrowLeft}'.repeat(6))
  }

  it('inserts a newline at the start of the code text', async () => {
    const ref = await setupCodeBlockEditor()
    await moveCaretToCodeStart()
    await userEvent.keyboard('{Enter}')
    await vi.waitFor(() => {
      expect(ref.current?.getMarkdown()).toContain('```js\n\nfoobar\n```')
    })
    expect(pmRoot.locate('pre').all()).toHaveLength(1)
    await expect.element(rogueBreak).not.toBeInTheDocument()
  })

  it('keeps the text before the caret when pressing enter mid-line', async () => {
    const ref = await setupCodeBlockEditor()
    await moveCaretToCodeStart()
    await userEvent.keyboard('{ArrowRight}'.repeat(3))
    await userEvent.keyboard('{Enter}')
    await vi.waitFor(() => {
      expect(ref.current?.getMarkdown()).toContain('```js\nfoo\nbar\n```')
    })
    expect(pmRoot.locate('pre').all()).toHaveLength(1)
    await expect.element(rogueBreak).not.toBeInTheDocument()
  })
})
