import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import {
  getSelectionSnapshot,
  setCaret,
  setupFixture,
  traceKeyAt,
  traceKeySelection,
  type Fixture,
} from '../testing/index.ts'

import { defineMarkMode, type MarkMode } from './mark-mode.ts'

const pmRoot = page.locate('.ProseMirror')
const label = pmRoot.getByTestId('wikilink')

// Text:    A   B   [   [   N   o   t   e   ]   ]   C   D
// Offset: 0   1   2   3   4   5   6   7   8   9  10  11  12
//
// The wikilink source `[[Note]]` occupies the characters between offsets 2 and
// 10. It is one atomic caret stop in every mark mode.
const TEXT = 'AB[[Note]]CD'

// A factory for an editor in `mode` showing the wikilink, shared by the suites
// below.
function setupMode(mode: MarkMode): () => Fixture {
  return () => {
    const fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineMarkMode(mode))
    fixture.set(n.doc(n.paragraph(TEXT)))
    return fixture
  }
}

const ALL_MODES: MarkMode[] = ['hide', 'focus', 'show']
const LABEL_MODES: MarkMode[] = ['hide', 'focus']

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

  it('hides the label in show mode, where the raw source stands in for it', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineMarkMode('show'))
    fixture.set(n.doc(n.paragraph('see [[Note]] here')))
    await expect.element(label).toHaveStyle({ display: 'none' })
  })
})

// A wikilink is one caret stop in every mode: arrowing onto it selects the whole
// `[[Note]]`, the next arrow steps past, and Backspace deletes it as a unit. The
// selection positions are identical across modes; only the rendering differs.
describe.each(ALL_MODES)('wikilink caret navigation in %s mode', (mode) => {
  const setup = setupMode(mode)

  it('ArrowRight selects the wikilink, then steps past into CD', async () => {
    using fixture = setup()
    setCaret(fixture, 1)
    expect(await traceKeySelection(fixture, 'ArrowRight', 5)).toEqual([
      'A▌B[[Note]]CD',
      'AB▌[[Note]]CD',
      'AB▛[[Note]]▟CD',
      'AB[[Note]]▌CD',
      'AB[[Note]]C▌D',
      'AB[[Note]]CD▌',
    ])
  })

  it('ArrowLeft selects the wikilink, then collapses to its left edge', async () => {
    using fixture = setup()
    setCaret(fixture, 11)
    expect(await traceKeySelection(fixture, 'ArrowLeft', 3)).toEqual([
      'AB[[Note]]C▌D',
      'AB[[Note]]▌CD',
      'AB▛[[Note]]▟CD',
      'AB▌[[Note]]CD',
    ])
  })

  it('Backspace deletes the wikilink as a unit, plain text one char', async () => {
    expect([
      await traceKeyAt(setup, 1, 'Backspace'), // between A and B
      await traceKeyAt(setup, 2, 'Backspace'), // just before the wikilink
      await traceKeyAt(setup, 10, 'Backspace'), // just after the wikilink
      await traceKeyAt(setup, 11, 'Backspace'), // between C and D
    ]).toEqual([
      'A▌B[[Note]]CD  ->  ▌B[[Note]]CD',
      'AB▌[[Note]]CD  ->  A▌[[Note]]CD',
      'AB[[Note]]▌CD  ->  AB▌CD',
      'AB[[Note]]C▌D  ->  AB[[Note]]▌D',
    ])
  })
})

// In hide and focus mode the rendered label stands in for the source, so a
// selected wikilink rings the label. Show mode shows the raw source and uses the
// native selection highlight, so it is covered by the navigation suite instead.
describe.each(LABEL_MODES)('wikilink selection ring in %s mode', (mode) => {
  const setup = setupMode(mode)

  it('rings the label only while the wikilink is selected', async () => {
    using fixture = setup()

    setCaret(fixture, 2)
    expect(getSelectionSnapshot(fixture.state)).toBe('AB▌[[Note]]CD')
    await expect.element(label).toHaveStyle({ outlineStyle: 'none' })

    await userEvent.keyboard('{ArrowRight}')
    expect(getSelectionSnapshot(fixture.state)).toBe('AB▛[[Note]]▟CD')
    await expect.element(label).toHaveStyle({ outlineStyle: 'solid' })

    await userEvent.keyboard('{ArrowRight}')
    expect(getSelectionSnapshot(fixture.state)).toBe('AB[[Note]]▌CD')
    await expect.element(label).toHaveStyle({ outlineStyle: 'none' })
  })

  it('rings the label when selected from its right edge', async () => {
    using fixture = setup()

    setCaret(fixture, 10)
    // REVIEW: DO NOT USE `toBe` if the string contains weird characters like ▌. Use toMatchInlineSnapshot instead so that this can be generated automatically in future.
    expect(getSelectionSnapshot(fixture.state)).toBe('AB[[Note]]▌CD')
    await expect.element(label).toHaveStyle({ outlineStyle: 'none' })

    await userEvent.keyboard('{ArrowLeft}')
    expect(getSelectionSnapshot(fixture.state)).toBe('AB▛[[Note]]▟CD')
    await expect.element(label).toHaveStyle({ outlineStyle: 'solid' })
  })
})
