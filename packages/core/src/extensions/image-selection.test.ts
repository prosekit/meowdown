import { TextSelection } from '@prosekit/pm/state'
import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { setupFixture, type Fixture } from '../testing/index.ts'

import { defineImage } from './image.ts'
import { defineMarkMode } from './mark-mode.ts'

const pmRoot = page.locate('.ProseMirror')
const preview = pmRoot.getByTestId('image-preview')

const IMAGE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="pink"/></svg>'
const IMAGE_URL = `data:image/svg+xml;base64,${btoa(IMAGE_SVG)}`

// Text:     A   B   C   !   [   i   m   g   ]   (   u   r   l   )   D   E   F
// Offset: 0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17
const TEXT = 'ABC![img](url)DEF'

function setup(): Fixture {
  const fixture = setupFixture()
  const { editor, n } = fixture
  editor.use(defineImage({ resolveImageUrl: () => IMAGE_URL }))
  editor.use(defineMarkMode('hide'))
  fixture.set(n.doc(n.paragraph(TEXT)))
  return fixture
}

function setCaret(fixture: Fixture, offset: number): void {
  const { view } = fixture
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, offset + 1)))
  view.focus()
}

describe('image selection ring in hide mode', () => {
  // Selecting the whole `![img](url)` rings the preview; a collapsed caret next
  // to it does not. This is what the `md-image-selected` decoration drives.
  it('rings the preview only while the image is selected', async () => {
    using fixture = setup()
    setCaret(fixture, 3) // ABC| just before the image

    await expect.element(preview).toHaveStyle({ outlineStyle: 'none' })

    await userEvent.keyboard('{ArrowRight}') // selects the whole image
    await expect.element(preview).toHaveStyle({ outlineStyle: 'solid' })

    await userEvent.keyboard('{ArrowRight}') // steps past, collapses the caret
    await expect.element(preview).toHaveStyle({ outlineStyle: 'none' })
  })

  it('rings the preview when selected from its right edge', async () => {
    using fixture = setup()
    setCaret(fixture, 14) // image|DEF just after the image

    await expect.element(preview).toHaveStyle({ outlineStyle: 'none' })

    await userEvent.keyboard('{ArrowLeft}') // selects the whole image
    await expect.element(preview).toHaveStyle({ outlineStyle: 'solid' })
  })
})
