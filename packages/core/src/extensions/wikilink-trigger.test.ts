import { AutocompleteRule, defineAutocomplete } from '@prosekit/extensions/autocomplete'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { setupFixture, type Fixture } from '../testing/index.ts'

import { defineWikilinkTrigger } from './wikilink-trigger.ts'

// In `userEvent.keyboard` a literal `[` must be escaped by doubling it.
const pressBracket = () => userEvent.keyboard('[[')
const pressWikilinkOpen = () => userEvent.keyboard('[[[[')
const pressModShiftK = () => userEvent.keyboard('{ControlOrMeta>}{Shift>}k{/Shift}{/ControlOrMeta}')

function setup(): Fixture {
  const fixture = setupFixture()
  fixture.editor.use(defineWikilinkTrigger())
  return fixture
}

function trackWikilinkMatches(fixture: Fixture): string[] {
  const matches: string[] = []
  fixture.editor.use(
    defineAutocomplete(
      new AutocompleteRule({
        regex: /\[\[[^[\]]*$/u,
        followCursor: true,
        onEnter: ({ match }) => {
          matches.push(match[0])
        },
      }),
    ),
  )
  return matches
}

describe('defineWikilinkTrigger', () => {
  it("'[' wraps a selected word into an open wikilink", async () => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('Cat <a>naps<b>')))
    fixture.view.focus()
    await pressBracket()
    expect(fixture.selectionSnapshot).toBe('Cat [[naps┃')
  })

  it("'[' with an empty selection types a literal bracket", async () => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('Cat <a>')))
    fixture.view.focus()
    await pressBracket()
    expect(fixture.selectionSnapshot).toBe('Cat [┃')
  })

  it("'[' drops a leading single bracket from the selection", async () => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('Cat <a>[naps<b>')))
    fixture.view.focus()
    await pressBracket()
    expect(fixture.selectionSnapshot).toBe('Cat [[naps┃')
  })

  it("'[' over a selection already starting with '[[' falls through to typing", async () => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('Cat <a>[[naps<b>')))
    fixture.view.focus()
    await pressBracket()
    // The command declines, so the keystroke replaces the selection normally.
    expect(fixture.selectionSnapshot).toBe('Cat [┃')
  })

  it("'[' over a selection spanning two blocks types normally", async () => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('o<a>ne'), n.paragraph('tw<b>o')))
    fixture.view.focus()
    await pressBracket()
    expect(fixture.selectionSnapshot).toBe('o[┃o')
  })

  it("'[' in a code block types a literal bracket", async () => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock('co<a>de<b>')))
    fixture.view.focus()
    await pressBracket()
    expect(fixture.selectionSnapshot).toBe('co[┃')
  })

  it('Mod-Shift-k inserts an open wikilink at an empty selection', async () => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('Cat <a>')))
    fixture.view.focus()
    await pressModShiftK()
    expect(fixture.selectionSnapshot).toBe('Cat [[┃')
  })

  it('Mod-Shift-k wraps a selection like the bracket does', async () => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('Cat <a>naps<b>')))
    fixture.view.focus()
    await pressModShiftK()
    expect(fixture.selectionSnapshot).toBe('Cat [[naps┃')
  })

  it('keeps autocomplete matched while ArrowRight includes existing text', async () => {
    using fixture = setup()
    const matches = trackWikilinkMatches(fixture)
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>Cat')))
    fixture.view.focus()

    await pressWikilinkOpen()
    expect(fixture.selectionSnapshot).toBe('[[┃Cat')

    await userEvent.keyboard('{ArrowRight}')
    expect(fixture.selectionSnapshot).toBe('[[C┃at')
    expect(matches.at(-1)).toBe('[[C')

    await userEvent.keyboard('{ArrowLeft}')
    expect(fixture.selectionSnapshot).toBe('[[┃Cat')
    expect(matches.at(-1)).toBe('[[')
  })

  it('does not activate autocomplete while ArrowRight crosses a loaded incomplete wikilink', async () => {
    using fixture = setup()
    const matches = trackWikilinkMatches(fixture)
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('[[<a>Cat')))
    fixture.view.focus()

    await userEvent.keyboard('{ArrowRight}')

    expect(fixture.selectionSnapshot).toBe('[[C┃at')
    expect(matches).toEqual([])
  })
})
