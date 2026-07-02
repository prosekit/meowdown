import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { getSelectionSnapshot, setupFixture, type Fixture } from '../testing/index.ts'

import { defineMarkMode, type MarkMode } from './mark-mode.ts'

const pmRoot = page.locate('.ProseMirror')
const label = pmRoot.getByTestId('wikilink')

const ALL_MODES: MarkMode[] = ['hide', 'focus', 'show']

// An editor in `mode` whose only content is the letter `A`, caret right after it
// (the `<a>` tag), exactly the state of a user who typed `A` then opened the
// wikilink menu.
function setupAfterA(mode: MarkMode): Fixture {
  const fixture = setupFixture()
  const { editor, n } = fixture
  editor.use(defineMarkMode(mode))
  fixture.set(n.doc(n.paragraph('A<a>')))
  fixture.view.focus()
  return fixture
}

// `editor.commands.insertText` is exactly what the wikilink menu's `onSelect`
// runs once an item is chosen.
function insertWikilink(fixture: Fixture, source: string): void {
  fixture.editor.commands.insertText({ text: source })
}

// The whole point of the fix: after inserting a wikilink, the caret is a real
// caret stop right after it, so the next typed character lands after the link.
describe.each(ALL_MODES)('typing after an inserted wikilink in %s mode', (mode) => {
  it('places the caret after the wikilink', () => {
    using fixture = setupAfterA(mode)
    insertWikilink(fixture, '[[Note]]')
    expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(`"A[[Note]]┃"`)
  })

  it('types the next character after the wikilink, not before it', async () => {
    using fixture = setupAfterA(mode)
    insertWikilink(fixture, '[[Note]]')
    await expect.element(pmRoot).toBeVisible()

    await userEvent.keyboard('B')
    expect(fixture.doc.textContent).toBe('A[[Note]]B')
    expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(`"A[[Note]]B┃"`)
  })

  it('keeps typing after the wikilink across several characters', async () => {
    using fixture = setupAfterA(mode)
    insertWikilink(fixture, '[[Note]]')
    await expect.element(pmRoot).toBeVisible()

    await userEvent.keyboard('Bar')
    expect(fixture.doc.textContent).toBe('A[[Note]]Bar')
    expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(`"A[[Note]]Bar┃"`)
  })

  it('types after an alias wikilink, after its label', async () => {
    using fixture = setupAfterA(mode)
    insertWikilink(fixture, '[[target|Alias]]')
    await expect.element(pmRoot).toBeVisible()

    await userEvent.keyboard('B')
    expect(fixture.doc.textContent).toBe('A[[target|Alias]]B')
    expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(`"A[[target|Alias]]B┃"`)
  })

  it('types after the second of two adjacent wikilinks', async () => {
    using fixture = setupAfterA(mode)
    insertWikilink(fixture, '[[One]][[Two]]')
    await expect.element(pmRoot).toBeVisible()

    await userEvent.keyboard('B')
    expect(fixture.doc.textContent).toBe('A[[One]][[Two]]B')
    expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(`"A[[One]][[Two]]B┃"`)
  })
})

// Regression: the boundary just before a wikilink always worked; the fix must not
// break it.
describe.each(ALL_MODES)('typing before an inserted wikilink in %s mode', (mode) => {
  it('lands a character typed before the wikilink between A and the link', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineMarkMode(mode))
    fixture.set(n.doc(n.paragraph('A<a>[[Note]]C')))
    fixture.view.focus()
    await expect.element(pmRoot).toBeVisible()

    await userEvent.keyboard('X')
    expect(fixture.doc.textContent).toBe('AX[[Note]]C')
    expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(`"AX┃[[Note]]C"`)
  })
})

// The mark view renders the label as the stand-in for the source in every mode,
// the wikilink being atomic everywhere.
describe('inserted wikilink rendering', () => {
  it('renders the target as the visible label in hide mode', async () => {
    using fixture = setupAfterA('hide')
    insertWikilink(fixture, '[[Note]]')
    await expect.element(label).toHaveTextContent('Note')
  })

  it('renders the alias as the visible label in hide mode', async () => {
    using fixture = setupAfterA('hide')
    insertWikilink(fixture, '[[target|Alias]]')
    await expect.element(label).toHaveTextContent('Alias')
  })

  it('renders the label in show mode', async () => {
    using fixture = setupAfterA('show')
    insertWikilink(fixture, '[[Note]]')
    await expect.element(label).toBeVisible()
    await expect.element(label).toHaveTextContent('Note')
  })
})
