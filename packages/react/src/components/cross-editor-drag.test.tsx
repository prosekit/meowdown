import '../testing/index.ts'

import { createRef, type Ref } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { mouse } from 'vitest-browser-commands/playwright'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'

import { hover, unhover } from '../testing/mouse.ts'

import { ProseKitEditor } from './prosekit-editor.tsx'
import type { EditorHandle } from './types.ts'

const yesterday = page.getByTestId('editor-yesterday')
const today = page.getByTestId('editor-today')

async function renderTwoEditors(refs: { yesterday: Ref<EditorHandle>; today: Ref<EditorHandle> }) {
  await unhover()
  return await render(
    <>
      <div data-testid="editor-yesterday">
        <ProseKitEditor ref={refs.yesterday} initialMarkdown={'Alpha\n\nBravo'} />
      </div>
      <div data-testid="editor-today">
        <ProseKitEditor ref={refs.today} initialMarkdown="Charlie" />
      </div>
    </>,
  )
}

describe('cross editor block drag', () => {
  it('moves the block into the other editor', async () => {
    const from = createRef<EditorHandle>()
    const to = createRef<EditorHandle>()
    await renderTwoEditors({ yesterday: from, today: to })

    await hover(yesterday.getByText('Alpha'))
    const start = await hover(yesterday.getByTestId('block-handle-drag'))
    await mouse.down()
    // Move a bit to fire dragstart before targeting the drop position.
    await mouse.move(start.x - 5, start.y - 5)

    // Drop near the top-left corner of "Charlie", i.e. before it.
    const target = await hover(today.getByText('Charlie'), { position: { x: 5, y: 5 } })
    // A move that changes the drag target dispatches only dragenter/dragleave;
    // nudge once more so the target receives the dragover that shows the
    // drop indicator.
    await mouse.move(target.x + 1, target.y)
    await expect.element(today.getByTestId('drop-indicator')).toBeVisible()
    await mouse.up()

    await vi.waitFor(() => {
      expect(from.current?.getMarkdown()).toBe('Bravo\n')
    })
    expect(to.current?.getMarkdown()).toBe('Alpha\n\nCharlie\n')
  })
})
