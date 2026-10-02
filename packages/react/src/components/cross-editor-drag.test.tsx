import '../testing/index.ts'

import { createRef, type ReactNode, type Ref } from 'react'
import { describe, expect, it } from 'vitest'
import { mouse } from 'vitest-browser-commands/playwright'
import { render } from 'vitest-browser-react'
import { page, server, type Locator } from 'vitest/browser'

import { hover, unhover } from '../testing/mouse.ts'

import { ProseKitEditor } from './prosekit-editor.tsx'
import type { EditorHandle } from './types.ts'

const yesterday = page.getByTestId('editor-yesterday')
const today = page.getByTestId('editor-today')

async function renderSource(ref: Ref<EditorHandle>, target: ReactNode) {
  await unhover()
  return await render(
    <>
      <div data-testid="editor-yesterday">
        <ProseKitEditor ref={ref} initialMarkdown={'Alpha\n\nBravo'} />
      </div>
      {target}
    </>,
  )
}

async function startAlphaDrag() {
  await hover(yesterday.getByText('Alpha'))
  const start = await hover(yesterday.getByTestId('block-handle-drag'))
  await mouse.down()
  // Move a bit to fire dragstart before targeting the drop position.
  await mouse.move(start.x - 5, start.y - 5)
}

async function dragOver(locator: Locator, position?: { x: number; y: number }) {
  const target = await hover(locator, position ? { position } : undefined)
  // A move that changes the drag target dispatches only dragenter/dragleave;
  // nudge once more so the target receives a dragover.
  await mouse.move(target.x + 1, target.y)
}

async function drop() {
  await mouse.up()
  await expect
    .element(yesterday.getByTestId('block-handle-drag'))
    .not.toHaveAttribute('data-dragging')
}

// Playwright's WebKit reports the wrong `dropEffect` on `dragend`.
// https://github.com/microsoft/playwright/issues/43082
describe.skipIf(server.browser === 'webkit')('cross editor block drag', () => {
  it('moves the block into the other editor', async () => {
    const from = createRef<EditorHandle>()
    const to = createRef<EditorHandle>()
    await renderSource(
      from,
      <div data-testid="editor-today">
        <ProseKitEditor ref={to} initialMarkdown="Charlie" />
      </div>,
    )

    await startAlphaDrag()
    // Drop near the top-left corner of "Charlie", i.e. before it.
    await dragOver(today.getByText('Charlie'), { x: 5, y: 5 })
    await expect.element(today.getByTestId('drop-indicator')).toBeVisible()
    await drop()

    expect(from.current?.getMarkdown()).toBe('Bravo\n')
    expect(to.current?.getMarkdown()).toBe('Alpha\n\nCharlie\n')
  })

  it('moves the block once inside the same editor', async () => {
    const from = createRef<EditorHandle>()
    await renderSource(from, null)

    await startAlphaDrag()
    // Drop near the bottom-left corner of "Bravo", i.e. after it.
    const bravo = yesterday.getByText('Bravo')
    await dragOver(bravo, { x: 5, y: bravo.element().getBoundingClientRect().height - 2 })
    await expect.element(yesterday.getByTestId('drop-indicator')).toBeVisible()
    await drop()

    expect(from.current?.getMarkdown()).toBe('Bravo\n\nAlpha\n')
  })

  it('keeps the block when the other editor is read-only', async () => {
    const from = createRef<EditorHandle>()
    const to = createRef<EditorHandle>()
    await renderSource(
      from,
      <div data-testid="editor-today">
        <ProseKitEditor ref={to} initialMarkdown="Charlie" readOnly />
      </div>,
    )

    await startAlphaDrag()
    await dragOver(today.getByText('Charlie'))
    await drop()

    expect(from.current?.getMarkdown()).toBe('Alpha\n\nBravo\n')
    expect(to.current?.getMarkdown()).toBe('Charlie\n')
  })
})
