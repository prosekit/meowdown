import { TextSelection } from '@prosekit/pm/state'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { getSelectionSnapshot, setupFixture, type Fixture } from '../testing/index.ts'

import { defineImage } from './image.ts'
import { defineMarkMode } from './mark-mode.ts'

// Text:     A   B   C   !   [   i   m   g   ]   (   u   r   l   )   D   E   F
// Offset: 0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17
//
// The hidden image source `![img](url)` occupies the characters between offsets
// 3 and 14.
const TEXT = 'ABC![img](url)DEF'

const IMAGE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="pink"/></svg>'
const BASE64_IMAGE_URL = `data:image/svg+xml;base64,${btoa(IMAGE_SVG)}`

function setup(): Fixture {
  const fixture = setupFixture()
  const { editor, n } = fixture
  editor.use(defineImage({ resolveImageUrl: () => BASE64_IMAGE_URL }))
  editor.use(defineMarkMode('hide'))
  const doc = n.doc(n.paragraph(TEXT))
  fixture.set(doc)
  return fixture
}

// Place a collapsed caret at text offset `offset`.
function setCaret(fixture: Fixture, offset: number): void {
  const { view } = fixture
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, offset + 1)))
  view.focus()
}

// Press `key` `times` times, capturing the selection snapshot before and after
// each press.
async function trace(fixture: Fixture, key: string, times: number): Promise<string[]> {
  const steps = [getSelectionSnapshot(fixture.state)]
  for (let index = 0; index < times; index++) {
    await userEvent.keyboard(`{${key}}`)
    steps.push(getSelectionSnapshot(fixture.state))
  }
  return steps
}

async function backspaceAt(offset: number): Promise<string> {
  using fixture = setup()
  setCaret(fixture, offset)
  const before = getSelectionSnapshot(fixture.state)
  await userEvent.keyboard('{Backspace}')
  return `${before}  ->  ${getSelectionSnapshot(fixture.state)}`
}

// A hidden image is one caret stop in hide mode: arrowing onto it selects the
// whole `![img](url)` (drawn as `<a>...<b>`), the next arrow steps past, and
// Backspace/Delete remove it as a unit.
describe('image caret navigation in hide mode', () => {
  // Reaches the left edge (offset 3), selects the image, collapses to the right
  // edge (offset 14), then steps on into DEF.
  it('ArrowRight selects the image, then steps past into DEF', async () => {
    using fixture = setup()
    setCaret(fixture, 1)
    expect(await trace(fixture, 'ArrowRight', 6)).toMatchInlineSnapshot(`
      [
        "A▌BC![img](url)DEF",
        "AB▌C![img](url)DEF",
        "ABC▌![img](url)DEF",
        "ABC▛![img](url)▟DEF",
        "ABC![img](url)▌DEF",
        "ABC![img](url)D▌EF",
        "ABC![img](url)DE▌F",
      ]
    `)
  })

  // Reaches the right edge (offset 14), selects the image, collapses to the left
  // edge (offset 3).
  it('ArrowLeft selects the image, then collapses to its left edge', async () => {
    using fixture = setup()
    setCaret(fixture, 15)
    expect(await trace(fixture, 'ArrowLeft', 3)).toMatchInlineSnapshot(`
      [
        "ABC![img](url)D▌EF",
        "ABC![img](url)▌DEF",
        "ABC▛![img](url)▟DEF",
        "ABC▌![img](url)DEF",
      ]
    `)
  })

  // Adjacent to the image (cases 2 and 3) Backspace removes the whole
  // `![img](url)`; in plain text (cases 1 and 4) it deletes one character.
  it('Backspace deletes the image as a unit, plain text one char', async () => {
    const result = [
      await backspaceAt(2), // between B and C
      await backspaceAt(3), // just before the image
      await backspaceAt(14), // just after the image
      await backspaceAt(15), // between D and E
    ]

    expect(result).toMatchInlineSnapshot(`
      [
        "AB▌C![img](url)DEF  ->  A▌C![img](url)DEF",
        "ABC▌![img](url)DEF  ->  AB▌![img](url)DEF",
        "ABC![img](url)▌DEF  ->  ABC▌DEF",
        "ABC![img](url)D▌EF  ->  ABC![img](url)▌EF",
      ]
    `)
  })
})
