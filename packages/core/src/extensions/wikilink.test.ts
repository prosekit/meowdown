import { TextSelection } from '@prosekit/pm/state'
import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { getSelectionSnapshot, setupFixture, type Fixture } from '../testing/index.ts'

import { defineMarkMode } from './mark-mode.ts'

const pmRoot = page.locate('.ProseMirror')
const label = pmRoot.getByTestId('wikilink')

// Text:    A   B   [   [   N   o   t   e   ]   ]   C   D
// Offset 0   1   2   3   4   5   6   7   8   9  10  11  12
//
// The hidden wikilink source `[[Note]]` occupies the characters between offsets
// 2 and 10.
const TEXT = 'AB[[Note]]CD'

// A hide-mode editor showing the wikilink, shared by the caret-navigation and
// selection-ring suites below.
function setupHidden(): Fixture {
  const fixture = setupFixture()
  const { editor, n } = fixture
  editor.use(defineMarkMode('hide'))
  fixture.set(n.doc(n.paragraph(TEXT)))
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
  using fixture = setupHidden()
  setCaret(fixture, offset)
  const before = getSelectionSnapshot(fixture.state)
  await userEvent.keyboard('{Backspace}')
  return `${before}  ->  ${getSelectionSnapshot(fixture.state)}`
}

describe('wikilink rendering', () => {
  it('renders the target as the label', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineMarkMode('hide'))
    fixture.set(n.doc(n.paragraph('see [[Note]] here')))
    await expect.element(label).toHaveTextContent('Note')
  })

  it('renders the alias as the label', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineMarkMode('hide'))
    fixture.set(n.doc(n.paragraph('see [[Note|My Note]] here')))
    await expect.element(label).toHaveTextContent('My Note')
  })
})

// A hidden wikilink is one caret stop in hide mode: arrowing onto it selects the
// whole `[[Note]]`, the next arrow steps past, and Backspace/Delete remove it as
// a unit.
describe('wikilink caret navigation in hide mode', () => {
  it('ArrowRight selects the wikilink, then steps past into CD', async () => {
    using fixture = setupHidden()
    setCaret(fixture, 1)
    expect(await trace(fixture, 'ArrowRight', 5)).toMatchInlineSnapshot(`
      [
        "A▌B[[Note]]CD",
        "AB▌[[Note]]CD",
        "AB▛[[Note]]▟CD",
        "AB[[Note]]▌CD",
        "AB[[Note]]C▌D",
        "AB[[Note]]CD▌",
      ]
    `)
  })

  it('ArrowLeft selects the wikilink, then collapses to its left edge', async () => {
    using fixture = setupHidden()
    setCaret(fixture, 11)
    expect(await trace(fixture, 'ArrowLeft', 3)).toMatchInlineSnapshot(`
      [
        "AB[[Note]]C▌D",
        "AB[[Note]]▌CD",
        "AB▛[[Note]]▟CD",
        "AB▌[[Note]]CD",
      ]
    `)
  })

  it('Backspace deletes the wikilink as a unit, plain text one char', async () => {
    const result = [
      await backspaceAt(1), // between A and B
      await backspaceAt(2), // just before the wikilink
      await backspaceAt(10), // just after the wikilink
      await backspaceAt(11), // between C and D
    ]

    expect(result).toMatchInlineSnapshot(`
      [
        "A▌B[[Note]]CD  ->  ▌B[[Note]]CD",
        "AB▌[[Note]]CD  ->  A▌[[Note]]CD",
        "AB[[Note]]▌CD  ->  AB▌CD",
        "AB[[Note]]C▌D  ->  AB[[Note]]▌D",
      ]
    `)
  })
})

describe('wikilink selection ring in hide mode', () => {
  // Selecting the whole `[[Note]]` rings the label; a collapsed caret next to it
  // does not. This is what the `md-wikilink-selected` decoration drives.
  it('rings the label only while the wikilink is selected', async () => {
    using fixture = setupHidden()
    setCaret(fixture, 2) // AB| just before the wikilink

    await expect.element(label).toHaveStyle({ outlineStyle: 'none' })

    await userEvent.keyboard('{ArrowRight}') // selects the whole wikilink
    await expect.element(label).toHaveStyle({ outlineStyle: 'solid' })

    await userEvent.keyboard('{ArrowRight}') // steps past, collapses the caret
    await expect.element(label).toHaveStyle({ outlineStyle: 'none' })
  })
})
