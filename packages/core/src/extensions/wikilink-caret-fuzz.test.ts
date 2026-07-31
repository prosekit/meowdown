import type { EditorNode } from '@prosekit/pm/model'
import { Selection, TextSelection } from '@prosekit/pm/state'
import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { markdownToDoc } from '../converters/md-to-pm.ts'
import { docToMarkdown } from '../converters/pm-to-md.ts'
import { getSelectionSnapshot, setupFixture } from '../testing/index.ts'

import type { MarkMode } from './mark-mode.ts'

const pmRoot = page.locate('.ProseMirror')

vi.setConfig({ testTimeout: 300_000 })

// A position is a caret stop when `Selection.near` settles exactly on it and
// stays an empty text selection. Positions inside a wikilink's hidden `[[` /
// `]]` source qualify: the editor should keep the caret out of them, but
// nothing in the schema forbids it.
function findCaretPositions(doc: EditorNode): number[] {
  const positions: number[] = []
  for (let pos = 0; pos <= doc.content.size; pos++) {
    const selection = Selection.near(doc.resolve(pos))
    if (selection instanceof TextSelection && selection.empty && selection.from === pos) {
      positions.push(pos)
    }
  }
  return positions
}


// A space typed at the end of a block is content, so trailing spaces are drawn as `·` rather than left to vanish into the snapshot.
function revealTrailingSpaces(text: string): string {
  return text
    .split('\n').map((line) => line.replace(/ +$/, (spaces) => '·'.repeat(spaces.length)))
    .join('\n')
}

// Press `key` once at every caret position of `markdown`. Each position records
// the selection before and after the press, then the markdown the document
// serializes to, which is where a lost list level or a dissolved wikilink shows
// up.
async function fuzzKey(mode: MarkMode, markdown: string, key: string): Promise<string> {
  const cases: string[] = []
  for (const pos of findCaretPositions(markdownToDoc(markdown))) {
    using fixture = setupFixture({ extensionOptions: { markMode: mode } })
    fixture.set(markdownToDoc(markdown, { nodes: fixture.editor.nodes }))
    fixture.view.dispatch(fixture.state.tr.setSelection(TextSelection.create(fixture.doc, pos)))
    fixture.view.focus()
    await expect.element(pmRoot).toBeVisible()

    const beforeMarkdown = revealTrailingSpaces(docToMarkdown(fixture.doc).replace(/\n+$/, ''))
    const beforeSelection = revealTrailingSpaces(getSelectionSnapshot(fixture.state))
    await userEvent.keyboard(key)
    const afterMarkdown = revealTrailingSpaces(revealTrailingSpaces(docToMarkdown(fixture.doc).replace(/\n+$/, '')))
    const afterSelection = getSelectionSnapshot(fixture.state)

    cases.push(
      [
        getSplitline(`=`, `pos ${pos}`),

        getSplitline('-', "before markdown"),
        beforeMarkdown,
        getSplitline('-', "before selection"),
        beforeSelection,

        getSplitline('-', "after markdown"),
        afterMarkdown,
        getSplitline('-', "after selection"),
        afterSelection,
      ].join('\n'),
    )
  }
  return cases.join('\n\n')
}

function getSplitline(char: string, label: string = "", labelLength: number = 10, prefixLength = 10): string {

  if (label) {
    return char.repeat(prefixLength) + (" " + label + " ").padEnd(labelLength, char) + char.repeat(prefixLength)
  } else {
    return char.repeat(prefixLength + labelLength + prefixLength)
  }
}

// The reported document: one bullet with two nested wikilink bullets.
const OUTLINE_MARKDOWN = `- top
  - [[foo]]
  - [[bar]]`

// A wikilink surrounded by plain text: the caret reaches the unit from both
// sides through ordinary text.
const INLINE_MARKDOWN = `a [[foo]] b`

// Two wikilinks with nothing between them: the boundary where atom navigation
// has to resolve which unit the caret belongs to.
const ADJACENT_MARKDOWN = `[[foo]][[bar]]`

describe('caret fuzz over a wikilink outline in focus mode', () => {
  it(
    'records Backspace at every caret position',
    async () => {
      expect(await fuzzKey('focus', OUTLINE_MARKDOWN, '{Backspace}')).toMatchInlineSnapshot(`
        """
        ========== pos 2 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        ┃top
        [[foo]]
        [[bar]]
        ---------- after markdown ----------
        top

        - [[foo]]
        - [[bar]]
        ---------- after selection ----------
        ┃top
        [[foo]]
        [[bar]]

        ========== pos 3 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        t┃op
        [[foo]]
        [[bar]]
        ---------- after markdown ----------
        - op
          - [[foo]]
          - [[bar]]
        ---------- after selection ----------
        ┃op
        [[foo]]
        [[bar]]

        ========== pos 4 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        to┃p
        [[foo]]
        [[bar]]
        ---------- after markdown ----------
        - tp
          - [[foo]]
          - [[bar]]
        ---------- after selection ----------
        t┃p
        [[foo]]
        [[bar]]

        ========== pos 5 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top┃
        [[foo]]
        [[bar]]
        ---------- after markdown ----------
        - to
          - [[foo]]
          - [[bar]]
        ---------- after selection ----------
        to┃
        [[foo]]
        [[bar]]

        ========== pos 8 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        ┃[[foo]]
        [[bar]]
        ---------- after markdown ----------
        - top

          [[foo]]

          - [[bar]]
        ---------- after selection ----------
        top
        ┃[[foo]]
        [[bar]]

        ========== pos 9 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [┃[foo]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [foo]]
          - [[bar]]
        ---------- after selection ----------
        top
        ┃[foo]]
        [[bar]]

        ========== pos 10 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[┃foo]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [foo]]
          - [[bar]]
        ---------- after selection ----------
        top
        [┃foo]]
        [[bar]]

        ========== pos 11 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[f┃oo]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[oo]]
          - [[bar]]
        ---------- after selection ----------
        top
        [[┃oo]]
        [[bar]]

        ========== pos 12 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[fo┃o]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[fo]]
          - [[bar]]
        ---------- after selection ----------
        top
        [[f┃o]]
        [[bar]]

        ========== pos 13 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo┃]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[fo]]
          - [[bar]]
        ---------- after selection ----------
        top
        [[fo┃]]
        [[bar]]

        ========== pos 14 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]┃]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[foo]
          - [[bar]]
        ---------- after selection ----------
        top
        [[foo┃]
        [[bar]]

        ========== pos 15 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]┃
        [[bar]]
        ---------- after markdown ----------
        - top
          -
          - [[bar]]
        ---------- after selection ----------
        top
        ┃
        [[bar]]

        ========== pos 19 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        ┃[[bar]]
        ---------- after markdown ----------
        - top

          - [[foo]]

          [[bar]]
        ---------- after selection ----------
        top
        [[foo]]
        ┃[[bar]]

        ========== pos 20 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [┃[bar]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [bar]]
        ---------- after selection ----------
        top
        [[foo]]
        ┃[bar]]

        ========== pos 21 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[┃bar]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [bar]]
        ---------- after selection ----------
        top
        [[foo]]
        [┃bar]]

        ========== pos 22 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[b┃ar]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[ar]]
        ---------- after selection ----------
        top
        [[foo]]
        [[┃ar]]

        ========== pos 23 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[ba┃r]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[br]]
        ---------- after selection ----------
        top
        [[foo]]
        [[b┃r]]

        ========== pos 24 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[bar┃]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[ba]]
        ---------- after selection ----------
        top
        [[foo]]
        [[ba┃]]

        ========== pos 25 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[bar]┃]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[bar]
        ---------- after selection ----------
        top
        [[foo]]
        [[bar┃]

        ========== pos 26 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[bar]]┃
        ---------- after markdown ----------
        - top
          - [[foo]]
          -
        ---------- after selection ----------
        top
        [[foo]]
        ┃
        """
      `)
    },

  )

  it(
    'records Space at every caret position',
    async () => {
      expect(await fuzzKey('focus', OUTLINE_MARKDOWN, ' ')).toMatchInlineSnapshot(`
        """
        ========== pos 2 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        ┃top
        [[foo]]
        [[bar]]
        ---------- after markdown ----------
        -  top
          - [[foo]]
          - [[bar]]
        ---------- after selection ----------
         ┃top
        [[foo]]
        [[bar]]

        ========== pos 3 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        t┃op
        [[foo]]
        [[bar]]
        ---------- after markdown ----------
        - t op
          - [[foo]]
          - [[bar]]
        ---------- after selection ----------
        t ┃op
        [[foo]]
        [[bar]]

        ========== pos 4 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        to┃p
        [[foo]]
        [[bar]]
        ---------- after markdown ----------
        - to p
          - [[foo]]
          - [[bar]]
        ---------- after selection ----------
        to ┃p
        [[foo]]
        [[bar]]

        ========== pos 5 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top┃
        [[foo]]
        [[bar]]
        ---------- after markdown ----------
        - top·
          - [[foo]]
          - [[bar]]
        ---------- after selection ----------
        top ┃
        [[foo]]
        [[bar]]

        ========== pos 8 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        ┃[[foo]]
        [[bar]]
        ---------- after markdown ----------
        - top
          -  [[foo]]
          - [[bar]]
        ---------- after selection ----------
        top
         ┃[[foo]]
        [[bar]]

        ========== pos 9 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [┃[foo]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [ [foo]]
          - [[bar]]
        ---------- after selection ----------
        top
        [ ┃[foo]]
        [[bar]]

        ========== pos 10 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[┃foo]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[ foo]]
          - [[bar]]
        ---------- after selection ----------
        top
        [[ ┃foo]]
        [[bar]]

        ========== pos 11 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[f┃oo]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[f oo]]
          - [[bar]]
        ---------- after selection ----------
        top
        [[f ┃oo]]
        [[bar]]

        ========== pos 12 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[fo┃o]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[fo o]]
          - [[bar]]
        ---------- after selection ----------
        top
        [[fo ┃o]]
        [[bar]]

        ========== pos 13 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo┃]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[foo ]]
          - [[bar]]
        ---------- after selection ----------
        top
        [[foo ┃]]
        [[bar]]

        ========== pos 14 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]┃]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[foo] ]
          - [[bar]]
        ---------- after selection ----------
        top
        [[foo] ┃]
        [[bar]]

        ========== pos 15 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]┃
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[foo]]·
          - [[bar]]
        ---------- after selection ----------
        top
        [[foo]] ┃
        [[bar]]

        ========== pos 19 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        ┃[[bar]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          -  [[bar]]
        ---------- after selection ----------
        top
        [[foo]]
         ┃[[bar]]

        ========== pos 20 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [┃[bar]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [ [bar]]
        ---------- after selection ----------
        top
        [[foo]]
        [ ┃[bar]]

        ========== pos 21 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[┃bar]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[ bar]]
        ---------- after selection ----------
        top
        [[foo]]
        [[ ┃bar]]

        ========== pos 22 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[b┃ar]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[b ar]]
        ---------- after selection ----------
        top
        [[foo]]
        [[b ┃ar]]

        ========== pos 23 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[ba┃r]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[ba r]]
        ---------- after selection ----------
        top
        [[foo]]
        [[ba ┃r]]

        ========== pos 24 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[bar┃]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[bar ]]
        ---------- after selection ----------
        top
        [[foo]]
        [[bar ┃]]

        ========== pos 25 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[bar]┃]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[bar] ]
        ---------- after selection ----------
        top
        [[foo]]
        [[bar] ┃]

        ========== pos 26 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[bar]]┃
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- after selection ----------
        top
        [[foo]]
        [[bar]] ┃
        """
      `)
    },

  )

  it(
    'records Enter at every caret position',
    async () => {
      expect(await fuzzKey('focus', OUTLINE_MARKDOWN, '{Enter}')).toMatchInlineSnapshot(`
        """
        ========== pos 2 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        ┃top
        [[foo]]
        [[bar]]
        ---------- after markdown ----------
        -
        - top
          - [[foo]]
          - [[bar]]
        ---------- after selection ----------

        ┃top
        [[foo]]
        [[bar]]

        ========== pos 3 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        t┃op
        [[foo]]
        [[bar]]
        ---------- after markdown ----------
        - t
        - op
          - [[foo]]
          - [[bar]]
        ---------- after selection ----------
        t
        ┃op
        [[foo]]
        [[bar]]

        ========== pos 4 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        to┃p
        [[foo]]
        [[bar]]
        ---------- after markdown ----------
        - to
        - p
          - [[foo]]
          - [[bar]]
        ---------- after selection ----------
        to
        ┃p
        [[foo]]
        [[bar]]

        ========== pos 5 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top┃
        [[foo]]
        [[bar]]
        ---------- after markdown ----------
        - top
        -
          - [[foo]]
          - [[bar]]
        ---------- after selection ----------
        top
        ┃
        [[foo]]
        [[bar]]

        ========== pos 8 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        ┃[[foo]]
        [[bar]]
        ---------- after markdown ----------
        - top
          -
          - [[foo]]
          - [[bar]]
        ---------- after selection ----------
        top

        ┃[[foo]]
        [[bar]]

        ========== pos 9 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [┃[foo]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [
          - [foo]]
          - [[bar]]
        ---------- after selection ----------
        top
        [
        ┃[foo]]
        [[bar]]

        ========== pos 10 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[┃foo]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[
          - foo]]
          - [[bar]]
        ---------- after selection ----------
        top
        [[
        ┃foo]]
        [[bar]]

        ========== pos 11 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[f┃oo]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[f
          - oo]]
          - [[bar]]
        ---------- after selection ----------
        top
        [[f
        ┃oo]]
        [[bar]]

        ========== pos 12 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[fo┃o]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[fo
          - o]]
          - [[bar]]
        ---------- after selection ----------
        top
        [[fo
        ┃o]]
        [[bar]]

        ========== pos 13 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo┃]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[foo
          - ]]
          - [[bar]]
        ---------- after selection ----------
        top
        [[foo
        ┃]]
        [[bar]]

        ========== pos 14 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]┃]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[foo]
          - ]
          - [[bar]]
        ---------- after selection ----------
        top
        [[foo]
        ┃]
        [[bar]]

        ========== pos 15 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]┃
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          -
          - [[bar]]
        ---------- after selection ----------
        top
        [[foo]]
        ┃
        [[bar]]

        ========== pos 19 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        ┃[[bar]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          -
          - [[bar]]
        ---------- after selection ----------
        top
        [[foo]]

        ┃[[bar]]

        ========== pos 20 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [┃[bar]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [
          - [bar]]
        ---------- after selection ----------
        top
        [[foo]]
        [
        ┃[bar]]

        ========== pos 21 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[┃bar]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[
          - bar]]
        ---------- after selection ----------
        top
        [[foo]]
        [[
        ┃bar]]

        ========== pos 22 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[b┃ar]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[b
          - ar]]
        ---------- after selection ----------
        top
        [[foo]]
        [[b
        ┃ar]]

        ========== pos 23 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[ba┃r]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[ba
          - r]]
        ---------- after selection ----------
        top
        [[foo]]
        [[ba
        ┃r]]

        ========== pos 24 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[bar┃]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[bar
          - ]]
        ---------- after selection ----------
        top
        [[foo]]
        [[bar
        ┃]]

        ========== pos 25 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[bar]┃]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[bar]
          - ]
        ---------- after selection ----------
        top
        [[foo]]
        [[bar]
        ┃]

        ========== pos 26 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[bar]]┃
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[bar]]
          -
        ---------- after selection ----------
        top
        [[foo]]
        [[bar]]
        ┃
        """
      `)
    },

  )
})

describe('caret fuzz over a wikilink outline in hide mode', () => {
  it(
    'records Backspace at every caret position',
    async () => {
      expect(await fuzzKey('hide', OUTLINE_MARKDOWN, '{Backspace}')).toMatchInlineSnapshot(`
        """
        ========== pos 2 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        ┃top
        [[foo]]
        [[bar]]
        ---------- after markdown ----------
        top

        - [[foo]]
        - [[bar]]
        ---------- after selection ----------
        ┃top
        [[foo]]
        [[bar]]

        ========== pos 3 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        t┃op
        [[foo]]
        [[bar]]
        ---------- after markdown ----------
        - op
          - [[foo]]
          - [[bar]]
        ---------- after selection ----------
        ┃op
        [[foo]]
        [[bar]]

        ========== pos 4 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        to┃p
        [[foo]]
        [[bar]]
        ---------- after markdown ----------
        - tp
          - [[foo]]
          - [[bar]]
        ---------- after selection ----------
        t┃p
        [[foo]]
        [[bar]]

        ========== pos 5 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top┃
        [[foo]]
        [[bar]]
        ---------- after markdown ----------
        - to
          - [[foo]]
          - [[bar]]
        ---------- after selection ----------
        to┃
        [[foo]]
        [[bar]]

        ========== pos 8 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        ┃[[foo]]
        [[bar]]
        ---------- after markdown ----------
        - top

          [[foo]]

          - [[bar]]
        ---------- after selection ----------
        top
        ┃[[foo]]
        [[bar]]

        ========== pos 9 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [┃[foo]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [foo]]
          - [[bar]]
        ---------- after selection ----------
        top
        ┃[foo]]
        [[bar]]

        ========== pos 10 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[┃foo]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [foo]]
          - [[bar]]
        ---------- after selection ----------
        top
        [┃foo]]
        [[bar]]

        ========== pos 11 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[f┃oo]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[oo]]
          - [[bar]]
        ---------- after selection ----------
        top
        [[┃oo]]
        [[bar]]

        ========== pos 12 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[fo┃o]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[fo]]
          - [[bar]]
        ---------- after selection ----------
        top
        [[f┃o]]
        [[bar]]

        ========== pos 13 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo┃]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[fo]]
          - [[bar]]
        ---------- after selection ----------
        top
        [[fo┃]]
        [[bar]]

        ========== pos 14 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]┃]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[foo]
          - [[bar]]
        ---------- after selection ----------
        top
        [[foo┃]
        [[bar]]

        ========== pos 15 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]┃
        [[bar]]
        ---------- after markdown ----------
        - top
          -
          - [[bar]]
        ---------- after selection ----------
        top
        ┃
        [[bar]]

        ========== pos 19 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        ┃[[bar]]
        ---------- after markdown ----------
        - top

          - [[foo]]

          [[bar]]
        ---------- after selection ----------
        top
        [[foo]]
        ┃[[bar]]

        ========== pos 20 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [┃[bar]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [bar]]
        ---------- after selection ----------
        top
        [[foo]]
        ┃[bar]]

        ========== pos 21 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[┃bar]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [bar]]
        ---------- after selection ----------
        top
        [[foo]]
        [┃bar]]

        ========== pos 22 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[b┃ar]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[ar]]
        ---------- after selection ----------
        top
        [[foo]]
        [[┃ar]]

        ========== pos 23 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[ba┃r]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[br]]
        ---------- after selection ----------
        top
        [[foo]]
        [[b┃r]]

        ========== pos 24 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[bar┃]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[ba]]
        ---------- after selection ----------
        top
        [[foo]]
        [[ba┃]]

        ========== pos 25 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[bar]┃]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[bar]
        ---------- after selection ----------
        top
        [[foo]]
        [[bar┃]

        ========== pos 26 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[bar]]┃
        ---------- after markdown ----------
        - top
          - [[foo]]
          -
        ---------- after selection ----------
        top
        [[foo]]
        ┃
        """
      `)
    },

  )

  it(
    'records Space at every caret position',
    async () => {
      expect(await fuzzKey('hide', OUTLINE_MARKDOWN, ' ')).toMatchInlineSnapshot(`
        """
        ========== pos 2 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        ┃top
        [[foo]]
        [[bar]]
        ---------- after markdown ----------
        -  top
          - [[foo]]
          - [[bar]]
        ---------- after selection ----------
         ┃top
        [[foo]]
        [[bar]]

        ========== pos 3 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        t┃op
        [[foo]]
        [[bar]]
        ---------- after markdown ----------
        - t op
          - [[foo]]
          - [[bar]]
        ---------- after selection ----------
        t ┃op
        [[foo]]
        [[bar]]

        ========== pos 4 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        to┃p
        [[foo]]
        [[bar]]
        ---------- after markdown ----------
        - to p
          - [[foo]]
          - [[bar]]
        ---------- after selection ----------
        to ┃p
        [[foo]]
        [[bar]]

        ========== pos 5 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top┃
        [[foo]]
        [[bar]]
        ---------- after markdown ----------
        - top·
          - [[foo]]
          - [[bar]]
        ---------- after selection ----------
        top ┃
        [[foo]]
        [[bar]]

        ========== pos 8 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        ┃[[foo]]
        [[bar]]
        ---------- after markdown ----------
        - top
          -  [[foo]]
          - [[bar]]
        ---------- after selection ----------
        top
         ┃[[foo]]
        [[bar]]

        ========== pos 9 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [┃[foo]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [ [foo]]
          - [[bar]]
        ---------- after selection ----------
        top
        [ ┃[foo]]
        [[bar]]

        ========== pos 10 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[┃foo]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[ foo]]
          - [[bar]]
        ---------- after selection ----------
        top
        [[ ┃foo]]
        [[bar]]

        ========== pos 11 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[f┃oo]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[f oo]]
          - [[bar]]
        ---------- after selection ----------
        top
        [[f ┃oo]]
        [[bar]]

        ========== pos 12 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[fo┃o]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[fo o]]
          - [[bar]]
        ---------- after selection ----------
        top
        [[fo ┃o]]
        [[bar]]

        ========== pos 13 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo┃]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[foo ]]
          - [[bar]]
        ---------- after selection ----------
        top
        [[foo ┃]]
        [[bar]]

        ========== pos 14 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]┃]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[foo] ]
          - [[bar]]
        ---------- after selection ----------
        top
        [[foo] ┃]
        [[bar]]

        ========== pos 15 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]┃
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[foo]]·
          - [[bar]]
        ---------- after selection ----------
        top
        [[foo]] ┃
        [[bar]]

        ========== pos 19 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        ┃[[bar]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          -  [[bar]]
        ---------- after selection ----------
        top
        [[foo]]
         ┃[[bar]]

        ========== pos 20 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [┃[bar]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [ [bar]]
        ---------- after selection ----------
        top
        [[foo]]
        [ ┃[bar]]

        ========== pos 21 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[┃bar]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[ bar]]
        ---------- after selection ----------
        top
        [[foo]]
        [[ ┃bar]]

        ========== pos 22 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[b┃ar]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[b ar]]
        ---------- after selection ----------
        top
        [[foo]]
        [[b ┃ar]]

        ========== pos 23 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[ba┃r]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[ba r]]
        ---------- after selection ----------
        top
        [[foo]]
        [[ba ┃r]]

        ========== pos 24 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[bar┃]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[bar ]]
        ---------- after selection ----------
        top
        [[foo]]
        [[bar ┃]]

        ========== pos 25 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[bar]┃]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[bar] ]
        ---------- after selection ----------
        top
        [[foo]]
        [[bar] ┃]

        ========== pos 26 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[bar]]┃
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- after selection ----------
        top
        [[foo]]
        [[bar]] ┃
        """
      `)
    },

  )

  it(
    'records Enter at every caret position',
    async () => {
      expect(await fuzzKey('hide', OUTLINE_MARKDOWN, '{Enter}')).toMatchInlineSnapshot(`
        """
        ========== pos 2 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        ┃top
        [[foo]]
        [[bar]]
        ---------- after markdown ----------
        -
        - top
          - [[foo]]
          - [[bar]]
        ---------- after selection ----------

        ┃top
        [[foo]]
        [[bar]]

        ========== pos 3 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        t┃op
        [[foo]]
        [[bar]]
        ---------- after markdown ----------
        - t
        - op
          - [[foo]]
          - [[bar]]
        ---------- after selection ----------
        t
        ┃op
        [[foo]]
        [[bar]]

        ========== pos 4 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        to┃p
        [[foo]]
        [[bar]]
        ---------- after markdown ----------
        - to
        - p
          - [[foo]]
          - [[bar]]
        ---------- after selection ----------
        to
        ┃p
        [[foo]]
        [[bar]]

        ========== pos 5 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top┃
        [[foo]]
        [[bar]]
        ---------- after markdown ----------
        - top
        -
          - [[foo]]
          - [[bar]]
        ---------- after selection ----------
        top
        ┃
        [[foo]]
        [[bar]]

        ========== pos 8 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        ┃[[foo]]
        [[bar]]
        ---------- after markdown ----------
        - top
          -
          - [[foo]]
          - [[bar]]
        ---------- after selection ----------
        top

        ┃[[foo]]
        [[bar]]

        ========== pos 9 =============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [┃[foo]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [
          - [foo]]
          - [[bar]]
        ---------- after selection ----------
        top
        [
        ┃[foo]]
        [[bar]]

        ========== pos 10 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[┃foo]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[
          - foo]]
          - [[bar]]
        ---------- after selection ----------
        top
        [[
        ┃foo]]
        [[bar]]

        ========== pos 11 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[f┃oo]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[f
          - oo]]
          - [[bar]]
        ---------- after selection ----------
        top
        [[f
        ┃oo]]
        [[bar]]

        ========== pos 12 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[fo┃o]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[fo
          - o]]
          - [[bar]]
        ---------- after selection ----------
        top
        [[fo
        ┃o]]
        [[bar]]

        ========== pos 13 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo┃]]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[foo
          - ]]
          - [[bar]]
        ---------- after selection ----------
        top
        [[foo
        ┃]]
        [[bar]]

        ========== pos 14 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]┃]
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[foo]
          - ]
          - [[bar]]
        ---------- after selection ----------
        top
        [[foo]
        ┃]
        [[bar]]

        ========== pos 15 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]┃
        [[bar]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          -
          - [[bar]]
        ---------- after selection ----------
        top
        [[foo]]
        ┃
        [[bar]]

        ========== pos 19 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        ┃[[bar]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          -
          - [[bar]]
        ---------- after selection ----------
        top
        [[foo]]

        ┃[[bar]]

        ========== pos 20 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [┃[bar]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [
          - [bar]]
        ---------- after selection ----------
        top
        [[foo]]
        [
        ┃[bar]]

        ========== pos 21 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[┃bar]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[
          - bar]]
        ---------- after selection ----------
        top
        [[foo]]
        [[
        ┃bar]]

        ========== pos 22 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[b┃ar]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[b
          - ar]]
        ---------- after selection ----------
        top
        [[foo]]
        [[b
        ┃ar]]

        ========== pos 23 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[ba┃r]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[ba
          - r]]
        ---------- after selection ----------
        top
        [[foo]]
        [[ba
        ┃r]]

        ========== pos 24 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[bar┃]]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[bar
          - ]]
        ---------- after selection ----------
        top
        [[foo]]
        [[bar
        ┃]]

        ========== pos 25 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[bar]┃]
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[bar]
          - ]
        ---------- after selection ----------
        top
        [[foo]]
        [[bar]
        ┃]

        ========== pos 26 ============
        ---------- before markdown ----------
        - top
          - [[foo]]
          - [[bar]]
        ---------- before selection ----------
        top
        [[foo]]
        [[bar]]┃
        ---------- after markdown ----------
        - top
          - [[foo]]
          - [[bar]]
          -
        ---------- after selection ----------
        top
        [[foo]]
        [[bar]]
        ┃
        """
      `)
    },

  )
})

describe('caret fuzz over a wikilink inside a paragraph in focus mode', () => {
  it(
    'records Backspace at every caret position',
    async () => {
      expect(await fuzzKey('focus', INLINE_MARKDOWN, '{Backspace}')).toMatchInlineSnapshot(`
        """
        ========== pos 1 =============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        ┃a [[foo]] b
        ---------- after markdown ----------
        a [[foo]] b
        ---------- after selection ----------
        ┃a [[foo]] b

        ========== pos 2 =============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a┃ [[foo]] b
        ---------- after markdown ----------
         [[foo]] b
        ---------- after selection ----------
        ┃ [[foo]] b

        ========== pos 3 =============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a ┃[[foo]] b
        ---------- after markdown ----------
        a[[foo]] b
        ---------- after selection ----------
        a┃[[foo]] b

        ========== pos 4 =============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a [┃[foo]] b
        ---------- after markdown ----------
        a [foo]] b
        ---------- after selection ----------
        a ┃[foo]] b

        ========== pos 5 =============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a [[┃foo]] b
        ---------- after markdown ----------
        a [foo]] b
        ---------- after selection ----------
        a [┃foo]] b

        ========== pos 6 =============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a [[f┃oo]] b
        ---------- after markdown ----------
        a [[oo]] b
        ---------- after selection ----------
        a [[┃oo]] b

        ========== pos 7 =============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a [[fo┃o]] b
        ---------- after markdown ----------
        a [[fo]] b
        ---------- after selection ----------
        a [[f┃o]] b

        ========== pos 8 =============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a [[foo┃]] b
        ---------- after markdown ----------
        a [[fo]] b
        ---------- after selection ----------
        a [[fo┃]] b

        ========== pos 9 =============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a [[foo]┃] b
        ---------- after markdown ----------
        a [[foo] b
        ---------- after selection ----------
        a [[foo┃] b

        ========== pos 10 ============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a [[foo]]┃ b
        ---------- after markdown ----------
        a  b
        ---------- after selection ----------
        a ┃ b

        ========== pos 11 ============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a [[foo]] ┃b
        ---------- after markdown ----------
        a [[foo]]b
        ---------- after selection ----------
        a [[foo]]┃b

        ========== pos 12 ============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a [[foo]] b┃
        ---------- after markdown ----------
        a [[foo]]
        ---------- after selection ----------
        a [[foo]] ┃
        """
      `)
    },

  )

  it(
    'records Space at every caret position',
    async () => {
      expect(await fuzzKey('focus', INLINE_MARKDOWN, ' ')).toMatchInlineSnapshot(`
        """
        ========== pos 1 =============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        ┃a [[foo]] b
        ---------- after markdown ----------
         a [[foo]] b
        ---------- after selection ----------
         ┃a [[foo]] b

        ========== pos 2 =============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a┃ [[foo]] b
        ---------- after markdown ----------
        a  [[foo]] b
        ---------- after selection ----------
        a ┃ [[foo]] b

        ========== pos 3 =============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a ┃[[foo]] b
        ---------- after markdown ----------
        a  [[foo]] b
        ---------- after selection ----------
        a  ┃[[foo]] b

        ========== pos 4 =============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a [┃[foo]] b
        ---------- after markdown ----------
        a [ [foo]] b
        ---------- after selection ----------
        a [ ┃[foo]] b

        ========== pos 5 =============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a [[┃foo]] b
        ---------- after markdown ----------
        a [[ foo]] b
        ---------- after selection ----------
        a [[ ┃foo]] b

        ========== pos 6 =============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a [[f┃oo]] b
        ---------- after markdown ----------
        a [[f oo]] b
        ---------- after selection ----------
        a [[f ┃oo]] b

        ========== pos 7 =============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a [[fo┃o]] b
        ---------- after markdown ----------
        a [[fo o]] b
        ---------- after selection ----------
        a [[fo ┃o]] b

        ========== pos 8 =============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a [[foo┃]] b
        ---------- after markdown ----------
        a [[foo ]] b
        ---------- after selection ----------
        a [[foo ┃]] b

        ========== pos 9 =============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a [[foo]┃] b
        ---------- after markdown ----------
        a [[foo] ] b
        ---------- after selection ----------
        a [[foo] ┃] b

        ========== pos 10 ============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a [[foo]]┃ b
        ---------- after markdown ----------
        a [[foo]]  b
        ---------- after selection ----------
        a [[foo]] ┃ b

        ========== pos 11 ============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a [[foo]] ┃b
        ---------- after markdown ----------
        a [[foo]]  b
        ---------- after selection ----------
        a [[foo]]  ┃b

        ========== pos 12 ============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a [[foo]] b┃
        ---------- after markdown ----------
        a [[foo]] b
        ---------- after selection ----------
        a [[foo]] b ┃
        """
      `)
    },

  )

  it(
    'records Enter at every caret position',
    async () => {
      expect(await fuzzKey('focus', INLINE_MARKDOWN, '{Enter}')).toMatchInlineSnapshot(`
        """
        ========== pos 1 =============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        ┃a [[foo]] b
        ---------- after markdown ----------
        a [[foo]] b
        ---------- after selection ----------

        ┃a [[foo]] b

        ========== pos 2 =============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a┃ [[foo]] b
        ---------- after markdown ----------
        a

         [[foo]] b
        ---------- after selection ----------
        a
        ┃ [[foo]] b

        ========== pos 3 =============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a ┃[[foo]] b
        ---------- after markdown ----------
        a·

        [[foo]] b
        ---------- after selection ----------
        a 
        ┃[[foo]] b

        ========== pos 4 =============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a [┃[foo]] b
        ---------- after markdown ----------
        a [

        [foo]] b
        ---------- after selection ----------
        a [
        ┃[foo]] b

        ========== pos 5 =============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a [[┃foo]] b
        ---------- after markdown ----------
        a [[

        foo]] b
        ---------- after selection ----------
        a [[
        ┃foo]] b

        ========== pos 6 =============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a [[f┃oo]] b
        ---------- after markdown ----------
        a [[f

        oo]] b
        ---------- after selection ----------
        a [[f
        ┃oo]] b

        ========== pos 7 =============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a [[fo┃o]] b
        ---------- after markdown ----------
        a [[fo

        o]] b
        ---------- after selection ----------
        a [[fo
        ┃o]] b

        ========== pos 8 =============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a [[foo┃]] b
        ---------- after markdown ----------
        a [[foo

        ]] b
        ---------- after selection ----------
        a [[foo
        ┃]] b

        ========== pos 9 =============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a [[foo]┃] b
        ---------- after markdown ----------
        a [[foo]

        ] b
        ---------- after selection ----------
        a [[foo]
        ┃] b

        ========== pos 10 ============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a [[foo]]┃ b
        ---------- after markdown ----------
        a [[foo]]

         b
        ---------- after selection ----------
        a [[foo]]
        ┃ b

        ========== pos 11 ============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a [[foo]] ┃b
        ---------- after markdown ----------
        a [[foo]]·

        b
        ---------- after selection ----------
        a [[foo]] 
        ┃b

        ========== pos 12 ============
        ---------- before markdown ----------
        a [[foo]] b
        ---------- before selection ----------
        a [[foo]] b┃
        ---------- after markdown ----------
        a [[foo]] b
        ---------- after selection ----------
        a [[foo]] b
        ┃
        """
      `)
    },

  )
})

describe('caret fuzz over two adjacent wikilinks in focus mode', () => {
  it(
    'records Backspace at every caret position',
    async () => {
      expect(await fuzzKey('focus', ADJACENT_MARKDOWN, '{Backspace}')).toMatchInlineSnapshot(`
        """
        ========== pos 1 =============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        ┃[[foo]][[bar]]
        ---------- after markdown ----------
        [[foo]][[bar]]
        ---------- after selection ----------
        ┃[[foo]][[bar]]

        ========== pos 2 =============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [┃[foo]][[bar]]
        ---------- after markdown ----------
        [foo]][[bar]]
        ---------- after selection ----------
        ┃[foo]][[bar]]

        ========== pos 3 =============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[┃foo]][[bar]]
        ---------- after markdown ----------
        [foo]][[bar]]
        ---------- after selection ----------
        [┃foo]][[bar]]

        ========== pos 4 =============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[f┃oo]][[bar]]
        ---------- after markdown ----------
        [[oo]][[bar]]
        ---------- after selection ----------
        [[┃oo]][[bar]]

        ========== pos 5 =============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[fo┃o]][[bar]]
        ---------- after markdown ----------
        [[fo]][[bar]]
        ---------- after selection ----------
        [[f┃o]][[bar]]

        ========== pos 6 =============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo┃]][[bar]]
        ---------- after markdown ----------
        [[fo]][[bar]]
        ---------- after selection ----------
        [[fo┃]][[bar]]

        ========== pos 7 =============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo]┃][[bar]]
        ---------- after markdown ----------
        [[foo][[bar]]
        ---------- after selection ----------
        [[foo┃][[bar]]

        ========== pos 8 =============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo]]┃[[bar]]
        ---------- after markdown ----------
        [[bar]]
        ---------- after selection ----------
        ┃[[bar]]

        ========== pos 9 =============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo]][┃[bar]]
        ---------- after markdown ----------
        [[foo]][bar]]
        ---------- after selection ----------
        [[foo]]┃[bar]]

        ========== pos 10 ============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo]][[┃bar]]
        ---------- after markdown ----------
        [[foo]][bar]]
        ---------- after selection ----------
        [[foo]][┃bar]]

        ========== pos 11 ============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo]][[b┃ar]]
        ---------- after markdown ----------
        [[foo]][[ar]]
        ---------- after selection ----------
        [[foo]][[┃ar]]

        ========== pos 12 ============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo]][[ba┃r]]
        ---------- after markdown ----------
        [[foo]][[br]]
        ---------- after selection ----------
        [[foo]][[b┃r]]

        ========== pos 13 ============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo]][[bar┃]]
        ---------- after markdown ----------
        [[foo]][[ba]]
        ---------- after selection ----------
        [[foo]][[ba┃]]

        ========== pos 14 ============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo]][[bar]┃]
        ---------- after markdown ----------
        [[foo]][[bar]
        ---------- after selection ----------
        [[foo]][[bar┃]

        ========== pos 15 ============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo]][[bar]]┃
        ---------- after markdown ----------
        [[foo]]
        ---------- after selection ----------
        [[foo]]┃
        """
      `)
    },

  )

  it(
    'records Space at every caret position',
    async () => {
      expect(await fuzzKey('focus', ADJACENT_MARKDOWN, ' ')).toMatchInlineSnapshot(`
        """
        ========== pos 1 =============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        ┃[[foo]][[bar]]
        ---------- after markdown ----------
         [[foo]][[bar]]
        ---------- after selection ----------
         ┃[[foo]][[bar]]

        ========== pos 2 =============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [┃[foo]][[bar]]
        ---------- after markdown ----------
        [ [foo]][[bar]]
        ---------- after selection ----------
        [ ┃[foo]][[bar]]

        ========== pos 3 =============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[┃foo]][[bar]]
        ---------- after markdown ----------
        [[ foo]][[bar]]
        ---------- after selection ----------
        [[ ┃foo]][[bar]]

        ========== pos 4 =============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[f┃oo]][[bar]]
        ---------- after markdown ----------
        [[f oo]][[bar]]
        ---------- after selection ----------
        [[f ┃oo]][[bar]]

        ========== pos 5 =============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[fo┃o]][[bar]]
        ---------- after markdown ----------
        [[fo o]][[bar]]
        ---------- after selection ----------
        [[fo ┃o]][[bar]]

        ========== pos 6 =============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo┃]][[bar]]
        ---------- after markdown ----------
        [[foo ]][[bar]]
        ---------- after selection ----------
        [[foo ┃]][[bar]]

        ========== pos 7 =============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo]┃][[bar]]
        ---------- after markdown ----------
        [[foo] ][[bar]]
        ---------- after selection ----------
        [[foo] ┃][[bar]]

        ========== pos 8 =============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo]]┃[[bar]]
        ---------- after markdown ----------
        [[foo]] [[bar]]
        ---------- after selection ----------
        [[foo]] ┃[[bar]]

        ========== pos 9 =============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo]][┃[bar]]
        ---------- after markdown ----------
        [[foo]][ [bar]]
        ---------- after selection ----------
        [[foo]][ ┃[bar]]

        ========== pos 10 ============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo]][[┃bar]]
        ---------- after markdown ----------
        [[foo]][[ bar]]
        ---------- after selection ----------
        [[foo]][[ ┃bar]]

        ========== pos 11 ============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo]][[b┃ar]]
        ---------- after markdown ----------
        [[foo]][[b ar]]
        ---------- after selection ----------
        [[foo]][[b ┃ar]]

        ========== pos 12 ============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo]][[ba┃r]]
        ---------- after markdown ----------
        [[foo]][[ba r]]
        ---------- after selection ----------
        [[foo]][[ba ┃r]]

        ========== pos 13 ============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo]][[bar┃]]
        ---------- after markdown ----------
        [[foo]][[bar ]]
        ---------- after selection ----------
        [[foo]][[bar ┃]]

        ========== pos 14 ============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo]][[bar]┃]
        ---------- after markdown ----------
        [[foo]][[bar] ]
        ---------- after selection ----------
        [[foo]][[bar] ┃]

        ========== pos 15 ============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo]][[bar]]┃
        ---------- after markdown ----------
        [[foo]][[bar]]
        ---------- after selection ----------
        [[foo]][[bar]] ┃
        """
      `)
    },

  )

  it(
    'records Enter at every caret position',
    async () => {
      expect(await fuzzKey('focus', ADJACENT_MARKDOWN, '{Enter}')).toMatchInlineSnapshot(`
        """
        ========== pos 1 =============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        ┃[[foo]][[bar]]
        ---------- after markdown ----------
        [[foo]][[bar]]
        ---------- after selection ----------

        ┃[[foo]][[bar]]

        ========== pos 2 =============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [┃[foo]][[bar]]
        ---------- after markdown ----------
        [

        [foo]][[bar]]
        ---------- after selection ----------
        [
        ┃[foo]][[bar]]

        ========== pos 3 =============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[┃foo]][[bar]]
        ---------- after markdown ----------
        [[

        foo]][[bar]]
        ---------- after selection ----------
        [[
        ┃foo]][[bar]]

        ========== pos 4 =============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[f┃oo]][[bar]]
        ---------- after markdown ----------
        [[f

        oo]][[bar]]
        ---------- after selection ----------
        [[f
        ┃oo]][[bar]]

        ========== pos 5 =============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[fo┃o]][[bar]]
        ---------- after markdown ----------
        [[fo

        o]][[bar]]
        ---------- after selection ----------
        [[fo
        ┃o]][[bar]]

        ========== pos 6 =============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo┃]][[bar]]
        ---------- after markdown ----------
        [[foo

        ]][[bar]]
        ---------- after selection ----------
        [[foo
        ┃]][[bar]]

        ========== pos 7 =============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo]┃][[bar]]
        ---------- after markdown ----------
        [[foo]

        ][[bar]]
        ---------- after selection ----------
        [[foo]
        ┃][[bar]]

        ========== pos 8 =============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo]]┃[[bar]]
        ---------- after markdown ----------
        [[foo]]

        [[bar]]
        ---------- after selection ----------
        [[foo]]
        ┃[[bar]]

        ========== pos 9 =============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo]][┃[bar]]
        ---------- after markdown ----------
        [[foo]][

        [bar]]
        ---------- after selection ----------
        [[foo]][
        ┃[bar]]

        ========== pos 10 ============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo]][[┃bar]]
        ---------- after markdown ----------
        [[foo]][[

        bar]]
        ---------- after selection ----------
        [[foo]][[
        ┃bar]]

        ========== pos 11 ============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo]][[b┃ar]]
        ---------- after markdown ----------
        [[foo]][[b

        ar]]
        ---------- after selection ----------
        [[foo]][[b
        ┃ar]]

        ========== pos 12 ============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo]][[ba┃r]]
        ---------- after markdown ----------
        [[foo]][[ba

        r]]
        ---------- after selection ----------
        [[foo]][[ba
        ┃r]]

        ========== pos 13 ============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo]][[bar┃]]
        ---------- after markdown ----------
        [[foo]][[bar

        ]]
        ---------- after selection ----------
        [[foo]][[bar
        ┃]]

        ========== pos 14 ============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo]][[bar]┃]
        ---------- after markdown ----------
        [[foo]][[bar]

        ]
        ---------- after selection ----------
        [[foo]][[bar]
        ┃]

        ========== pos 15 ============
        ---------- before markdown ----------
        [[foo]][[bar]]
        ---------- before selection ----------
        [[foo]][[bar]]┃
        ---------- after markdown ----------
        [[foo]][[bar]]
        ---------- after selection ----------
        [[foo]][[bar]]
        ┃
        """
      `)
    },

  )
})
