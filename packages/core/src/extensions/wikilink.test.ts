import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import {
  getSelectionSnapshot,
  setupFixture,
  traceKeyAt,
  traceKeySelection,
  type Fixture,
} from '../testing/index.ts'

import { defineMarkMode, type MarkMode } from './mark-mode.ts'

const pmRoot = page.locate('.ProseMirror')
const label = pmRoot.getByTestId('wikilink')

// A factory for an editor in `mode` showing the wikilink `[[Note]]`, one atom
// caret stop in every mark mode. `text` places the caret with a `<a>` tag.
function setupMode(mode: MarkMode): (text: string) => Fixture {
  return (text: string) => {
    const fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineMarkMode(mode))
    fixture.set(n.doc(n.paragraph(text)))
    fixture.view.focus()
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

  it('renders the label in show mode', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineMarkMode('show'))
    fixture.set(n.doc(n.paragraph('see [[Note]] here')))
    await expect.element(label).toBeVisible()
    await expect.element(label).toHaveTextContent('Note')
  })
})

// A wikilink is one caret stop in every mode: arrowing onto it selects the whole
// `[[Note]]`, the next arrow steps past, and Backspace deletes it as a unit. The
// selection positions are identical across modes; only the rendering differs.
describe.each(ALL_MODES)('wikilink caret navigation in %s mode', (mode) => {
  const setup = setupMode(mode)

  it('ArrowRight selects the wikilink, then steps past into CD', async () => {
    using fixture = setup('A<a>B[[Note]]CD')
    expect(await traceKeySelection(fixture, 'ArrowRight', 5)).toMatchInlineSnapshot(`
      [
        "A┃B[[Note]]CD",
        "AB┃[[Note]]CD",
        "AB❰[[Note]]❱CD",
        "AB[[Note]]┃CD",
        "AB[[Note]]C┃D",
        "AB[[Note]]CD┃",
      ]
    `)
  })

  it('ArrowLeft selects the wikilink, then collapses to its left edge', async () => {
    using fixture = setup('AB[[Note]]C<a>D')
    expect(await traceKeySelection(fixture, 'ArrowLeft', 3)).toMatchInlineSnapshot(`
      [
        "AB[[Note]]C┃D",
        "AB[[Note]]┃CD",
        "AB❰[[Note]]❱CD",
        "AB┃[[Note]]CD",
      ]
    `)
  })

  it('Backspace deletes the wikilink as a unit, plain text one char', async () => {
    expect([
      await traceKeyAt(setup, 'A<a>B[[Note]]CD', 'Backspace'),
      await traceKeyAt(setup, 'AB<a>[[Note]]CD', 'Backspace'),
      await traceKeyAt(setup, 'AB[[Note]]<a>CD', 'Backspace'),
      await traceKeyAt(setup, 'AB[[Note]]C<a>D', 'Backspace'),
    ]).toMatchInlineSnapshot(`
      [
        "A┃B[[Note]]CD  ->  ┃B[[Note]]CD",
        "AB┃[[Note]]CD  ->  A┃[[Note]]CD",
        "AB[[Note]]┃CD  ->  AB┃CD",
        "AB[[Note]]C┃D  ->  AB[[Note]]┃D",
      ]
    `)
  })
})

// A selected wikilink rings its rendered label. Checked in hide and focus mode;
// show mode behaves the same.
describe.each(LABEL_MODES)('wikilink selection ring in %s mode', (mode) => {
  const setup = setupMode(mode)

  it('rings the label only while the wikilink is selected', async () => {
    using fixture = setup('AB<a>[[Note]]CD')

    expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(`"AB┃[[Note]]CD"`)
    await expect.element(label).toHaveStyle({ outlineStyle: 'none' })

    await userEvent.keyboard('{ArrowRight}')
    expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(`"AB❰[[Note]]❱CD"`)
    await expect.element(label).toHaveStyle({ outlineStyle: 'solid' })

    await userEvent.keyboard('{ArrowRight}')
    expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(`"AB[[Note]]┃CD"`)
    await expect.element(label).toHaveStyle({ outlineStyle: 'none' })
  })

  it('rings the label when selected from its right edge', async () => {
    using fixture = setup('AB[[Note]]<a>CD')

    expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(`"AB[[Note]]┃CD"`)
    await expect.element(label).toHaveStyle({ outlineStyle: 'none' })

    await userEvent.keyboard('{ArrowLeft}')
    expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(`"AB❰[[Note]]❱CD"`)
    await expect.element(label).toHaveStyle({ outlineStyle: 'solid' })
  })
})

// Vertical caret motion must walk through a paragraph containing a wikilink,
// not orbit it: each ArrowDown moves one visual line lower.
describe('wikilink vertical caret navigation in focus mode', () => {
  function setupThreeParagraphs(): Fixture {
    const fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineMarkMode('focus'))
    fixture.set(
      n.doc(
        n.paragraph('paragraph <a>1'),
        n.paragraph('paragraph 2 [[WIKILINK]] text'),
        n.paragraph('paragraph 3 [[WIKILINK]]'),
        n.paragraph('paragraph 4'),
      ),
    )
    return fixture
  }

  it('ArrowDown from the first paragraph reaches the third paragraph', async () => {
    using fixture = setupThreeParagraphs()
    fixture.view.focus()
    expect(fixture.state.selection.$head.parent.textContent).toBe('paragraph 1')
    const steps = await traceKeySelection(fixture, 'ArrowDown', 7)
    expect(fixture.state.selection.$head.parent.textContent).toBe('paragraph 4')
    expect('\n' + Array.from(new Set(steps)).join('\n' + '-'.repeat(10) + '\n') + '\n')
      .toMatchInlineSnapshot(`
      "
      paragraph ┃1
      paragraph 2 [[WIKILINK]] text
      paragraph 3 [[WIKILINK]]
      paragraph 4
      ----------
      paragraph 1
      paragraph ┃2 [[WIKILINK]] text
      paragraph 3 [[WIKILINK]]
      paragraph 4
      ----------
      paragraph 1
      paragraph 2 [[WIKILINK]] text
      paragraph ┃3 [[WIKILINK]]
      paragraph 4
      ----------
      paragraph 1
      paragraph 2 [[WIKILINK]] text
      paragraph 3 [[WIKILINK]]
      paragraph ┃4
      ----------
      paragraph 1
      paragraph 2 [[WIKILINK]] text
      paragraph 3 [[WIKILINK]]
      paragraph 4┃
      "
    `)
  })
})
