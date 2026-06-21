import '../testing/index.ts'

import { isFirefox } from '@meowdown/vitest/helpers'
import { createRef, type Ref } from 'react'
import { describe, expect, it } from 'vitest'
import { mouse } from 'vitest-browser-commands/playwright'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'

import { hover, unhover } from '../testing/mouse.ts'

import { ProseKitEditor } from './prosekit-editor.tsx'
import type { EditorHandle } from './types.ts'

const pmRoot = page.locate('.ProseMirror')
const handle = page.getByTestId('block-handle')
const dropIndicator = page.getByTestId('drop-indicator')

interface RenderOptions {
  ref?: Ref<EditorHandle>
  blockHandle?: boolean
  readOnly?: boolean
}

// The mouse position persists across tests; park it first so a leftover
// position over the new editor cannot open the handle.
async function renderEditor({ ref, blockHandle, readOnly }: RenderOptions = {}) {
  await unhover()
  return await render(
    <ProseKitEditor
      ref={ref}
      initialMarkdown={'Alpha\n\nBravo'}
      blockHandle={blockHandle}
      readOnly={readOnly}
    />,
  )
}

describe('BlockHandle', () => {
  it('shows when hovering a block', async () => {
    await renderEditor()
    await expect.element(handle).not.toBeVisible()
    await hover(pmRoot.getByText('Alpha'))
    await expect.element(handle).toBeVisible()
  })

  it('hides when typing', async () => {
    await renderEditor()
    await pmRoot.getByText('Alpha').click()
    await expect.element(handle).toBeVisible()
    await userEvent.keyboard('x')
    await expect.element(handle).not.toBeVisible()
  })

  it('hides while text is selected', async () => {
    await renderEditor()
    await pmRoot.getByText('Alpha').click()
    await expect.element(handle).toBeVisible()
    await userEvent.keyboard('{Shift>}{Home}{/Shift}')
    await expect.element(handle).not.toBeVisible()
  })

  it('keeps the gutter padding on the editor but off a bare ProseMirror drag preview', async () => {
    await renderEditor()
    // The editor's gutter padding lives on `.meowdown-content`, not `.ProseMirror`.
    await expect.element(pmRoot).not.toHaveStyle({ paddingLeft: '0px' })

    // The block handle builds its drag preview as a bare `.ProseMirror.prosekit-dragging`
    // container appended to <body>; it must not inherit that gutter padding.
    const preview = document.createElement('div')
    preview.className = 'ProseMirror prosekit-dragging'
    preview.dataset.testid = 'drag-preview-probe'
    document.body.append(preview)
    try {
      await expect
        .element(page.getByTestId('drag-preview-probe'))
        .toHaveStyle({ paddingLeft: '0px' })
    } finally {
      preview.remove()
    }
  })

  it('selects the hovered block when pressing the drag handle', async () => {
    await renderEditor()
    await hover(pmRoot.getByText('Bravo'))
    await page.getByTestId('block-handle-drag').click()
    await expect.element(pmRoot.locate('p.ProseMirror-selectednode')).toHaveTextContent('Bravo')
  })

  it('does not render when blockHandle is false', async () => {
    await renderEditor({ blockHandle: false })
    await hover(pmRoot.getByText('Alpha'))
    await expect.element(handle).not.toBeInTheDocument()
    await expect.element(dropIndicator).not.toBeInTheDocument()
  })

  it('does not render when readOnly', async () => {
    await renderEditor({ readOnly: true })
    await hover(pmRoot.getByText('Alpha'))
    await expect.element(handle).not.toBeInTheDocument()
  })

  it.skipIf(
    // TODO: Fix the test on Firefox
    isFirefox(),
  )('drags a block to a new position, showing the drop indicator', async () => {
    const ref = createRef<EditorHandle>()
    await renderEditor({ ref })
    await hover(pmRoot.getByText('Bravo'))

    const start = await hover(page.getByTestId('block-handle-drag'))
    await mouse.down()
    // Move a bit to fire dragstart before targeting the drop position.
    await mouse.move(start.x - 5, start.y - 5)
    // Drop near the top-left corner of "Alpha", i.e. before it.
    const target = await hover(pmRoot.getByText('Alpha'), { position: { x: 5, y: 5 } })
    // A move that changes the drag target dispatches only dragenter/dragleave;
    // nudge once more so the target receives the dragover that shows the
    // drop indicator.
    await mouse.move(target.x + 1, target.y)
    await expect.element(dropIndicator).toBeVisible()
    await mouse.up()

    await expect.element(dropIndicator).not.toBeVisible()
    await expect.element(pmRoot.locate('p').first()).toHaveTextContent('Bravo')
    expect(ref.current?.getMarkdown()).toBe('Bravo\n\nAlpha\n')
  })
})
