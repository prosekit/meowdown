import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import {
  getSelectionSnapshot,
  setupFixture,
  traceKeyAt,
  traceKeySelection,
  type Fixture,
} from '../testing/index.ts'

import type { MarkMode } from './mark-mode.ts'

const pmRoot = page.locate('.ProseMirror')
const label = pmRoot.getByTestId('wikilink')

// A factory for an editor in `mode` showing the wikilink `[[Note]]`, one atom
// caret stop in every mark mode. `text` places the caret with a `<a>` tag.
function setupMode(mode: MarkMode): (text: string) => Fixture {
  return (text: string) => {
    const fixture = setupFixture({ extensionOptions: { markMode: mode } })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph(text)))
    fixture.view.focus()
    return fixture
  }
}

const ALL_MODES: MarkMode[] = ['hide', 'focus', 'show']
const LABEL_MODES: MarkMode[] = ['hide', 'focus']

describe('wikilink rendering', () => {
  it('renders the target as the label', async () => {
    using fixture = setupFixture({ extensionOptions: { markMode: 'hide' } })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('see [[Note]] here')))
    await expect.element(label).toHaveTextContent('Note')
  })

  it('renders the alias as the label', async () => {
    using fixture = setupFixture({ extensionOptions: { markMode: 'hide' } })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('see [[Note|My Note]] here')))
    await expect.element(label).toHaveTextContent('My Note')
  })

  it('renders the label in show mode', async () => {
    using fixture = setupFixture({ extensionOptions: { markMode: 'show' } })
    const { n } = fixture
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

// A wikilink whose label wraps across lines must not grow the paragraph by a
// phantom blank line: with an inline-block preview, the wrapped block fills
// the full line width, and on WebKit the trailing zero-width source box
// (`.md-atom-view-content`) then no longer fits beside it — it wraps onto an
// empty line with the paragraph's full strut height. The preview is a plain
// inline instead, fragmenting across lines and keeping the source box on the
// last fragment's line.
describe.each(ALL_MODES)('wrapped wikilink layout in %s mode', (mode) => {
  const setup = setupMode(mode)
  const longTarget = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ')

  it('adds no phantom line below a wrapped wikilink', async () => {
    using fixture = setup(`before [[${longTarget}]]<a>`)
    await expect.element(label).toBeVisible()

    const labelElement = fixture.dom.querySelector('.md-wikilink-view-label')!
    const fragments = Array.from(labelElement.getClientRects())
    // The label actually wrapped; otherwise the assertion below is vacuous.
    expect(fragments.length).toBeGreaterThan(1)

    // The paragraph ends flush under the label's last line fragment; a phantom
    // line would push its bottom a full line-height lower.
    const lastFragment = fragments[fragments.length - 1]
    const paragraphBottom = fixture.dom.querySelector('p')!.getBoundingClientRect().bottom
    expect(paragraphBottom - lastFragment.bottom).toBeLessThan(lastFragment.height / 2)
  })

  // The phantom line only reproduces on iOS WebKit — desktop engines (including
  // Playwright's WebKit) fit the zero-width source box beside a full-width
  // inline-block, so the geometry assertion above cannot catch a regression in
  // CI. Pin the inline display that fixes it directly.
  it.skip('renders the preview as a plain inline', async () => {
    using fixture = setup(`before [[${longTarget}]]<a>`)
    await expect.element(label).toBeVisible()

    const preview = fixture.dom.querySelector('.md-wikilink-view-preview')!
    expect(getComputedStyle(preview).display).toBe('inline')
  })
})

// Vertical caret motion must walk through a paragraph containing a wikilink,
describe('wikilink vertical caret navigation', () => {
  async function run(mode: MarkMode): Promise<string> {
    using fixture = setupFixture({ extensionOptions: { markMode: mode } })
    const { n } = fixture
    fixture.set(
      n.doc(
        n.paragraph('paragraph <a>1'),
        n.paragraph('paragraph 2 [[WIKILINK]] text'),
        n.paragraph('paragraph 3 [[WIKILINK]]'),
        n.paragraph('paragraph 4'),
      ),
    )
    fixture.view.focus()
    const steps = await traceKeySelection(fixture, 'ArrowDown', 7)
    return steps.map((step) => '\n' + step + '\n').join('-'.repeat(10))
  }

  it('can ArrowDown from the first paragraph to the last paragraph in hide mode', async () => {
    expect(await run('hide')).toMatchInlineSnapshot(`
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
  it('can ArrowDown from the first paragraph to the last paragraph in show mode', async () => {
    expect(await run('show')).toMatchInlineSnapshot(`
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
  it('can ArrowDown from the first paragraph to the last paragraph in focus mode', async () => {
    expect(await run('focus')).toMatchInlineSnapshot(`
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
