import '../testing/index.ts'

import { TextSelection } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'

import { ProseKitEditor } from './prosekit-editor.tsx'
import type { EditorHandle } from './types.ts'

const pmRoot = page.locate('.ProseMirror')
const tokens = pmRoot.locate('pre code [class*="tok-"]')
const rogueBreak = pmRoot.locate('br:not(.ProseMirror-trailingBreak)')

const CODE_BLOCK_MD = '```js\nfoobar\n```'

describe('enter after a composition commit', () => {
  async function setupCodeBlockEditor() {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} initialMarkdown={CODE_BLOCK_MD} />)
    // WebKit's clone-split only takes its production shape once highlight
    // token spans wrap the code text.
    await expect.element(tokens.first(), { timeout: 15000 }).toBeInTheDocument()
    const view = ref.current?.editor?.view
    if (!view) throw new Error('editor not mounted')
    return { ref, view }
  }

  function placeCaret(view: EditorView, position: number) {
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, position)))
    view.focus()
  }

  // See `code-block-enter-guard.test.ts` in the core package: synthetic
  // composition events arm prosemirror-view's post-composition keydown
  // swallow, so the following real Enter reaches WebKit's native editing.
  function fakeCompositionCommit(view: EditorView) {
    view.dom.dispatchEvent(new CompositionEvent('compositionstart'))
    view.dom.dispatchEvent(new CompositionEvent('compositionend'))
  }

  it('keeps one pre and no rogue br at the start of the code text', async () => {
    const { ref, view } = await setupCodeBlockEditor()
    placeCaret(view, 1)
    fakeCompositionCommit(view)
    await userEvent.keyboard('{Enter}')
    await vi.waitFor(() => {
      expect(ref.current?.getMarkdown()).toContain('```js\n\nfoobar\n```')
    })
    expect(pmRoot.locate('pre').all()).toHaveLength(1)
    await expect.element(rogueBreak).not.toBeInTheDocument()
  })

  it('keeps the text before the caret in the middle of the code text', async () => {
    const { ref, view } = await setupCodeBlockEditor()
    placeCaret(view, 4)
    fakeCompositionCommit(view)
    await userEvent.keyboard('{Enter}')
    await vi.waitFor(() => {
      expect(ref.current?.getMarkdown()).toContain('```js\nfoo\nbar\n```')
    })
    expect(pmRoot.locate('pre').all()).toHaveLength(1)
    await expect.element(rogueBreak).not.toBeInTheDocument()
  })
})
