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
        getSplitline(`=`, `position  ${pos}`),



        getSplitline('-', "markdown  before"),
        beforeMarkdown,
        getSplitline('-', "selection before"),
        beforeSelection,


        getSplitline('-', "markdown  after"),
        afterMarkdown,
        getSplitline('-', "selection after"),
        afterSelection,


      ].join('\n'),
    )
  }
  return cases.join('\n\n')
}

function getSplitline(char: string, label: string = "", labelLength: number = 18, prefixLength = 5): string {

  if (label) {
    return char.repeat(prefixLength) + (" " + label + " ").padEnd(labelLength, char ) + char.repeat(prefixLength)
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
        ===== position  2 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        ┃top
        [[foo]]
        [[bar]]
        ----- markdown  after ------
        top

        - [[foo]]
        - [[bar]]
        ----- selection after ------
        ┃top
        [[foo]]
        [[bar]]

        ===== position  3 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        t┃op
        [[foo]]
        [[bar]]
        ----- markdown  after ------
        - op
          - [[foo]]
          - [[bar]]
        ----- selection after ------
        ┃op
        [[foo]]
        [[bar]]

        ===== position  4 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        to┃p
        [[foo]]
        [[bar]]
        ----- markdown  after ------
        - tp
          - [[foo]]
          - [[bar]]
        ----- selection after ------
        t┃p
        [[foo]]
        [[bar]]

        ===== position  5 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top┃
        [[foo]]
        [[bar]]
        ----- markdown  after ------
        - to
          - [[foo]]
          - [[bar]]
        ----- selection after ------
        to┃
        [[foo]]
        [[bar]]

        ===== position  8 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        ┃[[foo]]
        [[bar]]
        ----- markdown  after ------
        - top

          [[foo]]

          - [[bar]]
        ----- selection after ------
        top
        ┃[[foo]]
        [[bar]]

        ===== position  9 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [┃[foo]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [foo]]
          - [[bar]]
        ----- selection after ------
        top
        ┃[foo]]
        [[bar]]

        ===== position  10 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[┃foo]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [foo]]
          - [[bar]]
        ----- selection after ------
        top
        [┃foo]]
        [[bar]]

        ===== position  11 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[f┃oo]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [[oo]]
          - [[bar]]
        ----- selection after ------
        top
        [[┃oo]]
        [[bar]]

        ===== position  12 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[fo┃o]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [[fo]]
          - [[bar]]
        ----- selection after ------
        top
        [[f┃o]]
        [[bar]]

        ===== position  13 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo┃]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [[fo]]
          - [[bar]]
        ----- selection after ------
        top
        [[fo┃]]
        [[bar]]

        ===== position  14 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]┃]
        [[bar]]
        ----- markdown  after ------
        - top
          - [[foo]
          - [[bar]]
        ----- selection after ------
        top
        [[foo┃]
        [[bar]]

        ===== position  15 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]┃
        [[bar]]
        ----- markdown  after ------
        - top
          -
          - [[bar]]
        ----- selection after ------
        top
        ┃
        [[bar]]

        ===== position  19 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        ┃[[bar]]
        ----- markdown  after ------
        - top

          - [[foo]]

          [[bar]]
        ----- selection after ------
        top
        [[foo]]
        ┃[[bar]]

        ===== position  20 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [┃[bar]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [bar]]
        ----- selection after ------
        top
        [[foo]]
        ┃[bar]]

        ===== position  21 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[┃bar]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [bar]]
        ----- selection after ------
        top
        [[foo]]
        [┃bar]]

        ===== position  22 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[b┃ar]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[ar]]
        ----- selection after ------
        top
        [[foo]]
        [[┃ar]]

        ===== position  23 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[ba┃r]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[br]]
        ----- selection after ------
        top
        [[foo]]
        [[b┃r]]

        ===== position  24 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[bar┃]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[ba]]
        ----- selection after ------
        top
        [[foo]]
        [[ba┃]]

        ===== position  25 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[bar]┃]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[bar]
        ----- selection after ------
        top
        [[foo]]
        [[bar┃]

        ===== position  26 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[bar]]┃
        ----- markdown  after ------
        - top
          - [[foo]]
          -
        ----- selection after ------
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
        ===== position  2 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        ┃top
        [[foo]]
        [[bar]]
        ----- markdown  after ------
        -  top
          - [[foo]]
          - [[bar]]
        ----- selection after ------
         ┃top
        [[foo]]
        [[bar]]

        ===== position  3 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        t┃op
        [[foo]]
        [[bar]]
        ----- markdown  after ------
        - t op
          - [[foo]]
          - [[bar]]
        ----- selection after ------
        t ┃op
        [[foo]]
        [[bar]]

        ===== position  4 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        to┃p
        [[foo]]
        [[bar]]
        ----- markdown  after ------
        - to p
          - [[foo]]
          - [[bar]]
        ----- selection after ------
        to ┃p
        [[foo]]
        [[bar]]

        ===== position  5 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top┃
        [[foo]]
        [[bar]]
        ----- markdown  after ------
        - top·
          - [[foo]]
          - [[bar]]
        ----- selection after ------
        top ┃
        [[foo]]
        [[bar]]

        ===== position  8 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        ┃[[foo]]
        [[bar]]
        ----- markdown  after ------
        - top
          -  [[foo]]
          - [[bar]]
        ----- selection after ------
        top
         ┃[[foo]]
        [[bar]]

        ===== position  9 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [┃[foo]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [ [foo]]
          - [[bar]]
        ----- selection after ------
        top
        [ ┃[foo]]
        [[bar]]

        ===== position  10 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[┃foo]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [[ foo]]
          - [[bar]]
        ----- selection after ------
        top
        [[ ┃foo]]
        [[bar]]

        ===== position  11 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[f┃oo]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [[f oo]]
          - [[bar]]
        ----- selection after ------
        top
        [[f ┃oo]]
        [[bar]]

        ===== position  12 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[fo┃o]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [[fo o]]
          - [[bar]]
        ----- selection after ------
        top
        [[fo ┃o]]
        [[bar]]

        ===== position  13 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo┃]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [[foo ]]
          - [[bar]]
        ----- selection after ------
        top
        [[foo ┃]]
        [[bar]]

        ===== position  14 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]┃]
        [[bar]]
        ----- markdown  after ------
        - top
          - [[foo] ]
          - [[bar]]
        ----- selection after ------
        top
        [[foo] ┃]
        [[bar]]

        ===== position  15 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]┃
        [[bar]]
        ----- markdown  after ------
        - top
          - [[foo]]·
          - [[bar]]
        ----- selection after ------
        top
        [[foo]] ┃
        [[bar]]

        ===== position  19 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        ┃[[bar]]
        ----- markdown  after ------
        - top
          - [[foo]]
          -  [[bar]]
        ----- selection after ------
        top
        [[foo]]
         ┃[[bar]]

        ===== position  20 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [┃[bar]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [ [bar]]
        ----- selection after ------
        top
        [[foo]]
        [ ┃[bar]]

        ===== position  21 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[┃bar]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[ bar]]
        ----- selection after ------
        top
        [[foo]]
        [[ ┃bar]]

        ===== position  22 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[b┃ar]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[b ar]]
        ----- selection after ------
        top
        [[foo]]
        [[b ┃ar]]

        ===== position  23 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[ba┃r]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[ba r]]
        ----- selection after ------
        top
        [[foo]]
        [[ba ┃r]]

        ===== position  24 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[bar┃]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[bar ]]
        ----- selection after ------
        top
        [[foo]]
        [[bar ┃]]

        ===== position  25 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[bar]┃]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[bar] ]
        ----- selection after ------
        top
        [[foo]]
        [[bar] ┃]

        ===== position  26 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[bar]]┃
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[bar]]
        ----- selection after ------
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
        ===== position  2 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        ┃top
        [[foo]]
        [[bar]]
        ----- markdown  after ------
        -
        - top
          - [[foo]]
          - [[bar]]
        ----- selection after ------

        ┃top
        [[foo]]
        [[bar]]

        ===== position  3 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        t┃op
        [[foo]]
        [[bar]]
        ----- markdown  after ------
        - t
        - op
          - [[foo]]
          - [[bar]]
        ----- selection after ------
        t
        ┃op
        [[foo]]
        [[bar]]

        ===== position  4 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        to┃p
        [[foo]]
        [[bar]]
        ----- markdown  after ------
        - to
        - p
          - [[foo]]
          - [[bar]]
        ----- selection after ------
        to
        ┃p
        [[foo]]
        [[bar]]

        ===== position  5 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top┃
        [[foo]]
        [[bar]]
        ----- markdown  after ------
        - top
        -
          - [[foo]]
          - [[bar]]
        ----- selection after ------
        top
        ┃
        [[foo]]
        [[bar]]

        ===== position  8 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        ┃[[foo]]
        [[bar]]
        ----- markdown  after ------
        - top
          -
          - [[foo]]
          - [[bar]]
        ----- selection after ------
        top

        ┃[[foo]]
        [[bar]]

        ===== position  9 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [┃[foo]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [
          - [foo]]
          - [[bar]]
        ----- selection after ------
        top
        [
        ┃[foo]]
        [[bar]]

        ===== position  10 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[┃foo]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [[
          - foo]]
          - [[bar]]
        ----- selection after ------
        top
        [[
        ┃foo]]
        [[bar]]

        ===== position  11 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[f┃oo]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [[f
          - oo]]
          - [[bar]]
        ----- selection after ------
        top
        [[f
        ┃oo]]
        [[bar]]

        ===== position  12 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[fo┃o]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [[fo
          - o]]
          - [[bar]]
        ----- selection after ------
        top
        [[fo
        ┃o]]
        [[bar]]

        ===== position  13 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo┃]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [[foo
          - ]]
          - [[bar]]
        ----- selection after ------
        top
        [[foo
        ┃]]
        [[bar]]

        ===== position  14 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]┃]
        [[bar]]
        ----- markdown  after ------
        - top
          - [[foo]
          - ]
          - [[bar]]
        ----- selection after ------
        top
        [[foo]
        ┃]
        [[bar]]

        ===== position  15 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]┃
        [[bar]]
        ----- markdown  after ------
        - top
          - [[foo]]
          -
          - [[bar]]
        ----- selection after ------
        top
        [[foo]]
        ┃
        [[bar]]

        ===== position  19 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        ┃[[bar]]
        ----- markdown  after ------
        - top
          - [[foo]]
          -
          - [[bar]]
        ----- selection after ------
        top
        [[foo]]

        ┃[[bar]]

        ===== position  20 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [┃[bar]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [
          - [bar]]
        ----- selection after ------
        top
        [[foo]]
        [
        ┃[bar]]

        ===== position  21 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[┃bar]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[
          - bar]]
        ----- selection after ------
        top
        [[foo]]
        [[
        ┃bar]]

        ===== position  22 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[b┃ar]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[b
          - ar]]
        ----- selection after ------
        top
        [[foo]]
        [[b
        ┃ar]]

        ===== position  23 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[ba┃r]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[ba
          - r]]
        ----- selection after ------
        top
        [[foo]]
        [[ba
        ┃r]]

        ===== position  24 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[bar┃]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[bar
          - ]]
        ----- selection after ------
        top
        [[foo]]
        [[bar
        ┃]]

        ===== position  25 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[bar]┃]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[bar]
          - ]
        ----- selection after ------
        top
        [[foo]]
        [[bar]
        ┃]

        ===== position  26 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[bar]]┃
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[bar]]
          -
        ----- selection after ------
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
        ===== position  2 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        ┃top
        [[foo]]
        [[bar]]
        ----- markdown  after ------
        top

        - [[foo]]
        - [[bar]]
        ----- selection after ------
        ┃top
        [[foo]]
        [[bar]]

        ===== position  3 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        t┃op
        [[foo]]
        [[bar]]
        ----- markdown  after ------
        - op
          - [[foo]]
          - [[bar]]
        ----- selection after ------
        ┃op
        [[foo]]
        [[bar]]

        ===== position  4 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        to┃p
        [[foo]]
        [[bar]]
        ----- markdown  after ------
        - tp
          - [[foo]]
          - [[bar]]
        ----- selection after ------
        t┃p
        [[foo]]
        [[bar]]

        ===== position  5 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top┃
        [[foo]]
        [[bar]]
        ----- markdown  after ------
        - to
          - [[foo]]
          - [[bar]]
        ----- selection after ------
        to┃
        [[foo]]
        [[bar]]

        ===== position  8 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        ┃[[foo]]
        [[bar]]
        ----- markdown  after ------
        - top

          [[foo]]

          - [[bar]]
        ----- selection after ------
        top
        ┃[[foo]]
        [[bar]]

        ===== position  9 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [┃[foo]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [foo]]
          - [[bar]]
        ----- selection after ------
        top
        ┃[foo]]
        [[bar]]

        ===== position  10 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[┃foo]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [foo]]
          - [[bar]]
        ----- selection after ------
        top
        [┃foo]]
        [[bar]]

        ===== position  11 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[f┃oo]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [[oo]]
          - [[bar]]
        ----- selection after ------
        top
        [[┃oo]]
        [[bar]]

        ===== position  12 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[fo┃o]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [[fo]]
          - [[bar]]
        ----- selection after ------
        top
        [[f┃o]]
        [[bar]]

        ===== position  13 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo┃]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [[fo]]
          - [[bar]]
        ----- selection after ------
        top
        [[fo┃]]
        [[bar]]

        ===== position  14 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]┃]
        [[bar]]
        ----- markdown  after ------
        - top
          - [[foo]
          - [[bar]]
        ----- selection after ------
        top
        [[foo┃]
        [[bar]]

        ===== position  15 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]┃
        [[bar]]
        ----- markdown  after ------
        - top
          -
          - [[bar]]
        ----- selection after ------
        top
        ┃
        [[bar]]

        ===== position  19 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        ┃[[bar]]
        ----- markdown  after ------
        - top

          - [[foo]]

          [[bar]]
        ----- selection after ------
        top
        [[foo]]
        ┃[[bar]]

        ===== position  20 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [┃[bar]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [bar]]
        ----- selection after ------
        top
        [[foo]]
        ┃[bar]]

        ===== position  21 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[┃bar]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [bar]]
        ----- selection after ------
        top
        [[foo]]
        [┃bar]]

        ===== position  22 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[b┃ar]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[ar]]
        ----- selection after ------
        top
        [[foo]]
        [[┃ar]]

        ===== position  23 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[ba┃r]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[br]]
        ----- selection after ------
        top
        [[foo]]
        [[b┃r]]

        ===== position  24 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[bar┃]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[ba]]
        ----- selection after ------
        top
        [[foo]]
        [[ba┃]]

        ===== position  25 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[bar]┃]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[bar]
        ----- selection after ------
        top
        [[foo]]
        [[bar┃]

        ===== position  26 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[bar]]┃
        ----- markdown  after ------
        - top
          - [[foo]]
          -
        ----- selection after ------
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
        ===== position  2 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        ┃top
        [[foo]]
        [[bar]]
        ----- markdown  after ------
        -  top
          - [[foo]]
          - [[bar]]
        ----- selection after ------
         ┃top
        [[foo]]
        [[bar]]

        ===== position  3 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        t┃op
        [[foo]]
        [[bar]]
        ----- markdown  after ------
        - t op
          - [[foo]]
          - [[bar]]
        ----- selection after ------
        t ┃op
        [[foo]]
        [[bar]]

        ===== position  4 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        to┃p
        [[foo]]
        [[bar]]
        ----- markdown  after ------
        - to p
          - [[foo]]
          - [[bar]]
        ----- selection after ------
        to ┃p
        [[foo]]
        [[bar]]

        ===== position  5 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top┃
        [[foo]]
        [[bar]]
        ----- markdown  after ------
        - top·
          - [[foo]]
          - [[bar]]
        ----- selection after ------
        top ┃
        [[foo]]
        [[bar]]

        ===== position  8 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        ┃[[foo]]
        [[bar]]
        ----- markdown  after ------
        - top
          -  [[foo]]
          - [[bar]]
        ----- selection after ------
        top
         ┃[[foo]]
        [[bar]]

        ===== position  9 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [┃[foo]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [ [foo]]
          - [[bar]]
        ----- selection after ------
        top
        [ ┃[foo]]
        [[bar]]

        ===== position  10 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[┃foo]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [[ foo]]
          - [[bar]]
        ----- selection after ------
        top
        [[ ┃foo]]
        [[bar]]

        ===== position  11 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[f┃oo]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [[f oo]]
          - [[bar]]
        ----- selection after ------
        top
        [[f ┃oo]]
        [[bar]]

        ===== position  12 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[fo┃o]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [[fo o]]
          - [[bar]]
        ----- selection after ------
        top
        [[fo ┃o]]
        [[bar]]

        ===== position  13 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo┃]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [[foo ]]
          - [[bar]]
        ----- selection after ------
        top
        [[foo ┃]]
        [[bar]]

        ===== position  14 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]┃]
        [[bar]]
        ----- markdown  after ------
        - top
          - [[foo] ]
          - [[bar]]
        ----- selection after ------
        top
        [[foo] ┃]
        [[bar]]

        ===== position  15 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]┃
        [[bar]]
        ----- markdown  after ------
        - top
          - [[foo]]·
          - [[bar]]
        ----- selection after ------
        top
        [[foo]] ┃
        [[bar]]

        ===== position  19 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        ┃[[bar]]
        ----- markdown  after ------
        - top
          - [[foo]]
          -  [[bar]]
        ----- selection after ------
        top
        [[foo]]
         ┃[[bar]]

        ===== position  20 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [┃[bar]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [ [bar]]
        ----- selection after ------
        top
        [[foo]]
        [ ┃[bar]]

        ===== position  21 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[┃bar]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[ bar]]
        ----- selection after ------
        top
        [[foo]]
        [[ ┃bar]]

        ===== position  22 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[b┃ar]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[b ar]]
        ----- selection after ------
        top
        [[foo]]
        [[b ┃ar]]

        ===== position  23 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[ba┃r]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[ba r]]
        ----- selection after ------
        top
        [[foo]]
        [[ba ┃r]]

        ===== position  24 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[bar┃]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[bar ]]
        ----- selection after ------
        top
        [[foo]]
        [[bar ┃]]

        ===== position  25 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[bar]┃]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[bar] ]
        ----- selection after ------
        top
        [[foo]]
        [[bar] ┃]

        ===== position  26 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[bar]]┃
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[bar]]
        ----- selection after ------
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
        ===== position  2 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        ┃top
        [[foo]]
        [[bar]]
        ----- markdown  after ------
        -
        - top
          - [[foo]]
          - [[bar]]
        ----- selection after ------

        ┃top
        [[foo]]
        [[bar]]

        ===== position  3 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        t┃op
        [[foo]]
        [[bar]]
        ----- markdown  after ------
        - t
        - op
          - [[foo]]
          - [[bar]]
        ----- selection after ------
        t
        ┃op
        [[foo]]
        [[bar]]

        ===== position  4 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        to┃p
        [[foo]]
        [[bar]]
        ----- markdown  after ------
        - to
        - p
          - [[foo]]
          - [[bar]]
        ----- selection after ------
        to
        ┃p
        [[foo]]
        [[bar]]

        ===== position  5 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top┃
        [[foo]]
        [[bar]]
        ----- markdown  after ------
        - top
        -
          - [[foo]]
          - [[bar]]
        ----- selection after ------
        top
        ┃
        [[foo]]
        [[bar]]

        ===== position  8 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        ┃[[foo]]
        [[bar]]
        ----- markdown  after ------
        - top
          -
          - [[foo]]
          - [[bar]]
        ----- selection after ------
        top

        ┃[[foo]]
        [[bar]]

        ===== position  9 ==========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [┃[foo]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [
          - [foo]]
          - [[bar]]
        ----- selection after ------
        top
        [
        ┃[foo]]
        [[bar]]

        ===== position  10 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[┃foo]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [[
          - foo]]
          - [[bar]]
        ----- selection after ------
        top
        [[
        ┃foo]]
        [[bar]]

        ===== position  11 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[f┃oo]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [[f
          - oo]]
          - [[bar]]
        ----- selection after ------
        top
        [[f
        ┃oo]]
        [[bar]]

        ===== position  12 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[fo┃o]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [[fo
          - o]]
          - [[bar]]
        ----- selection after ------
        top
        [[fo
        ┃o]]
        [[bar]]

        ===== position  13 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo┃]]
        [[bar]]
        ----- markdown  after ------
        - top
          - [[foo
          - ]]
          - [[bar]]
        ----- selection after ------
        top
        [[foo
        ┃]]
        [[bar]]

        ===== position  14 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]┃]
        [[bar]]
        ----- markdown  after ------
        - top
          - [[foo]
          - ]
          - [[bar]]
        ----- selection after ------
        top
        [[foo]
        ┃]
        [[bar]]

        ===== position  15 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]┃
        [[bar]]
        ----- markdown  after ------
        - top
          - [[foo]]
          -
          - [[bar]]
        ----- selection after ------
        top
        [[foo]]
        ┃
        [[bar]]

        ===== position  19 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        ┃[[bar]]
        ----- markdown  after ------
        - top
          - [[foo]]
          -
          - [[bar]]
        ----- selection after ------
        top
        [[foo]]

        ┃[[bar]]

        ===== position  20 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [┃[bar]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [
          - [bar]]
        ----- selection after ------
        top
        [[foo]]
        [
        ┃[bar]]

        ===== position  21 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[┃bar]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[
          - bar]]
        ----- selection after ------
        top
        [[foo]]
        [[
        ┃bar]]

        ===== position  22 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[b┃ar]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[b
          - ar]]
        ----- selection after ------
        top
        [[foo]]
        [[b
        ┃ar]]

        ===== position  23 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[ba┃r]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[ba
          - r]]
        ----- selection after ------
        top
        [[foo]]
        [[ba
        ┃r]]

        ===== position  24 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[bar┃]]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[bar
          - ]]
        ----- selection after ------
        top
        [[foo]]
        [[bar
        ┃]]

        ===== position  25 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[bar]┃]
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[bar]
          - ]
        ----- selection after ------
        top
        [[foo]]
        [[bar]
        ┃]

        ===== position  26 =========
        ----- markdown  before -----
        - top
          - [[foo]]
          - [[bar]]
        ----- selection before -----
        top
        [[foo]]
        [[bar]]┃
        ----- markdown  after ------
        - top
          - [[foo]]
          - [[bar]]
          -
        ----- selection after ------
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
        ===== position  1 ==========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        ┃a [[foo]] b
        ----- markdown  after ------
        a [[foo]] b
        ----- selection after ------
        ┃a [[foo]] b

        ===== position  2 ==========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a┃ [[foo]] b
        ----- markdown  after ------
         [[foo]] b
        ----- selection after ------
        ┃ [[foo]] b

        ===== position  3 ==========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a ┃[[foo]] b
        ----- markdown  after ------
        a[[foo]] b
        ----- selection after ------
        a┃[[foo]] b

        ===== position  4 ==========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a [┃[foo]] b
        ----- markdown  after ------
        a [foo]] b
        ----- selection after ------
        a ┃[foo]] b

        ===== position  5 ==========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a [[┃foo]] b
        ----- markdown  after ------
        a [foo]] b
        ----- selection after ------
        a [┃foo]] b

        ===== position  6 ==========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a [[f┃oo]] b
        ----- markdown  after ------
        a [[oo]] b
        ----- selection after ------
        a [[┃oo]] b

        ===== position  7 ==========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a [[fo┃o]] b
        ----- markdown  after ------
        a [[fo]] b
        ----- selection after ------
        a [[f┃o]] b

        ===== position  8 ==========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a [[foo┃]] b
        ----- markdown  after ------
        a [[fo]] b
        ----- selection after ------
        a [[fo┃]] b

        ===== position  9 ==========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a [[foo]┃] b
        ----- markdown  after ------
        a [[foo] b
        ----- selection after ------
        a [[foo┃] b

        ===== position  10 =========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a [[foo]]┃ b
        ----- markdown  after ------
        a  b
        ----- selection after ------
        a ┃ b

        ===== position  11 =========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a [[foo]] ┃b
        ----- markdown  after ------
        a [[foo]]b
        ----- selection after ------
        a [[foo]]┃b

        ===== position  12 =========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a [[foo]] b┃
        ----- markdown  after ------
        a [[foo]]
        ----- selection after ------
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
        ===== position  1 ==========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        ┃a [[foo]] b
        ----- markdown  after ------
         a [[foo]] b
        ----- selection after ------
         ┃a [[foo]] b

        ===== position  2 ==========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a┃ [[foo]] b
        ----- markdown  after ------
        a  [[foo]] b
        ----- selection after ------
        a ┃ [[foo]] b

        ===== position  3 ==========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a ┃[[foo]] b
        ----- markdown  after ------
        a  [[foo]] b
        ----- selection after ------
        a  ┃[[foo]] b

        ===== position  4 ==========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a [┃[foo]] b
        ----- markdown  after ------
        a [ [foo]] b
        ----- selection after ------
        a [ ┃[foo]] b

        ===== position  5 ==========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a [[┃foo]] b
        ----- markdown  after ------
        a [[ foo]] b
        ----- selection after ------
        a [[ ┃foo]] b

        ===== position  6 ==========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a [[f┃oo]] b
        ----- markdown  after ------
        a [[f oo]] b
        ----- selection after ------
        a [[f ┃oo]] b

        ===== position  7 ==========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a [[fo┃o]] b
        ----- markdown  after ------
        a [[fo o]] b
        ----- selection after ------
        a [[fo ┃o]] b

        ===== position  8 ==========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a [[foo┃]] b
        ----- markdown  after ------
        a [[foo ]] b
        ----- selection after ------
        a [[foo ┃]] b

        ===== position  9 ==========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a [[foo]┃] b
        ----- markdown  after ------
        a [[foo] ] b
        ----- selection after ------
        a [[foo] ┃] b

        ===== position  10 =========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a [[foo]]┃ b
        ----- markdown  after ------
        a [[foo]]  b
        ----- selection after ------
        a [[foo]] ┃ b

        ===== position  11 =========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a [[foo]] ┃b
        ----- markdown  after ------
        a [[foo]]  b
        ----- selection after ------
        a [[foo]]  ┃b

        ===== position  12 =========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a [[foo]] b┃
        ----- markdown  after ------
        a [[foo]] b
        ----- selection after ------
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
        ===== position  1 ==========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        ┃a [[foo]] b
        ----- markdown  after ------
        a [[foo]] b
        ----- selection after ------

        ┃a [[foo]] b

        ===== position  2 ==========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a┃ [[foo]] b
        ----- markdown  after ------
        a

         [[foo]] b
        ----- selection after ------
        a
        ┃ [[foo]] b

        ===== position  3 ==========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a ┃[[foo]] b
        ----- markdown  after ------
        a·

        [[foo]] b
        ----- selection after ------
        a 
        ┃[[foo]] b

        ===== position  4 ==========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a [┃[foo]] b
        ----- markdown  after ------
        a [

        [foo]] b
        ----- selection after ------
        a [
        ┃[foo]] b

        ===== position  5 ==========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a [[┃foo]] b
        ----- markdown  after ------
        a [[

        foo]] b
        ----- selection after ------
        a [[
        ┃foo]] b

        ===== position  6 ==========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a [[f┃oo]] b
        ----- markdown  after ------
        a [[f

        oo]] b
        ----- selection after ------
        a [[f
        ┃oo]] b

        ===== position  7 ==========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a [[fo┃o]] b
        ----- markdown  after ------
        a [[fo

        o]] b
        ----- selection after ------
        a [[fo
        ┃o]] b

        ===== position  8 ==========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a [[foo┃]] b
        ----- markdown  after ------
        a [[foo

        ]] b
        ----- selection after ------
        a [[foo
        ┃]] b

        ===== position  9 ==========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a [[foo]┃] b
        ----- markdown  after ------
        a [[foo]

        ] b
        ----- selection after ------
        a [[foo]
        ┃] b

        ===== position  10 =========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a [[foo]]┃ b
        ----- markdown  after ------
        a [[foo]]

         b
        ----- selection after ------
        a [[foo]]
        ┃ b

        ===== position  11 =========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a [[foo]] ┃b
        ----- markdown  after ------
        a [[foo]]·

        b
        ----- selection after ------
        a [[foo]] 
        ┃b

        ===== position  12 =========
        ----- markdown  before -----
        a [[foo]] b
        ----- selection before -----
        a [[foo]] b┃
        ----- markdown  after ------
        a [[foo]] b
        ----- selection after ------
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
        ===== position  1 ==========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        ┃[[foo]][[bar]]
        ----- markdown  after ------
        [[foo]][[bar]]
        ----- selection after ------
        ┃[[foo]][[bar]]

        ===== position  2 ==========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [┃[foo]][[bar]]
        ----- markdown  after ------
        [foo]][[bar]]
        ----- selection after ------
        ┃[foo]][[bar]]

        ===== position  3 ==========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[┃foo]][[bar]]
        ----- markdown  after ------
        [foo]][[bar]]
        ----- selection after ------
        [┃foo]][[bar]]

        ===== position  4 ==========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[f┃oo]][[bar]]
        ----- markdown  after ------
        [[oo]][[bar]]
        ----- selection after ------
        [[┃oo]][[bar]]

        ===== position  5 ==========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[fo┃o]][[bar]]
        ----- markdown  after ------
        [[fo]][[bar]]
        ----- selection after ------
        [[f┃o]][[bar]]

        ===== position  6 ==========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo┃]][[bar]]
        ----- markdown  after ------
        [[fo]][[bar]]
        ----- selection after ------
        [[fo┃]][[bar]]

        ===== position  7 ==========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo]┃][[bar]]
        ----- markdown  after ------
        [[foo][[bar]]
        ----- selection after ------
        [[foo┃][[bar]]

        ===== position  8 ==========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo]]┃[[bar]]
        ----- markdown  after ------
        [[bar]]
        ----- selection after ------
        ┃[[bar]]

        ===== position  9 ==========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo]][┃[bar]]
        ----- markdown  after ------
        [[foo]][bar]]
        ----- selection after ------
        [[foo]]┃[bar]]

        ===== position  10 =========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo]][[┃bar]]
        ----- markdown  after ------
        [[foo]][bar]]
        ----- selection after ------
        [[foo]][┃bar]]

        ===== position  11 =========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo]][[b┃ar]]
        ----- markdown  after ------
        [[foo]][[ar]]
        ----- selection after ------
        [[foo]][[┃ar]]

        ===== position  12 =========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo]][[ba┃r]]
        ----- markdown  after ------
        [[foo]][[br]]
        ----- selection after ------
        [[foo]][[b┃r]]

        ===== position  13 =========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo]][[bar┃]]
        ----- markdown  after ------
        [[foo]][[ba]]
        ----- selection after ------
        [[foo]][[ba┃]]

        ===== position  14 =========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo]][[bar]┃]
        ----- markdown  after ------
        [[foo]][[bar]
        ----- selection after ------
        [[foo]][[bar┃]

        ===== position  15 =========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo]][[bar]]┃
        ----- markdown  after ------
        [[foo]]
        ----- selection after ------
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
        ===== position  1 ==========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        ┃[[foo]][[bar]]
        ----- markdown  after ------
         [[foo]][[bar]]
        ----- selection after ------
         ┃[[foo]][[bar]]

        ===== position  2 ==========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [┃[foo]][[bar]]
        ----- markdown  after ------
        [ [foo]][[bar]]
        ----- selection after ------
        [ ┃[foo]][[bar]]

        ===== position  3 ==========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[┃foo]][[bar]]
        ----- markdown  after ------
        [[ foo]][[bar]]
        ----- selection after ------
        [[ ┃foo]][[bar]]

        ===== position  4 ==========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[f┃oo]][[bar]]
        ----- markdown  after ------
        [[f oo]][[bar]]
        ----- selection after ------
        [[f ┃oo]][[bar]]

        ===== position  5 ==========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[fo┃o]][[bar]]
        ----- markdown  after ------
        [[fo o]][[bar]]
        ----- selection after ------
        [[fo ┃o]][[bar]]

        ===== position  6 ==========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo┃]][[bar]]
        ----- markdown  after ------
        [[foo ]][[bar]]
        ----- selection after ------
        [[foo ┃]][[bar]]

        ===== position  7 ==========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo]┃][[bar]]
        ----- markdown  after ------
        [[foo] ][[bar]]
        ----- selection after ------
        [[foo] ┃][[bar]]

        ===== position  8 ==========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo]]┃[[bar]]
        ----- markdown  after ------
        [[foo]] [[bar]]
        ----- selection after ------
        [[foo]] ┃[[bar]]

        ===== position  9 ==========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo]][┃[bar]]
        ----- markdown  after ------
        [[foo]][ [bar]]
        ----- selection after ------
        [[foo]][ ┃[bar]]

        ===== position  10 =========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo]][[┃bar]]
        ----- markdown  after ------
        [[foo]][[ bar]]
        ----- selection after ------
        [[foo]][[ ┃bar]]

        ===== position  11 =========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo]][[b┃ar]]
        ----- markdown  after ------
        [[foo]][[b ar]]
        ----- selection after ------
        [[foo]][[b ┃ar]]

        ===== position  12 =========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo]][[ba┃r]]
        ----- markdown  after ------
        [[foo]][[ba r]]
        ----- selection after ------
        [[foo]][[ba ┃r]]

        ===== position  13 =========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo]][[bar┃]]
        ----- markdown  after ------
        [[foo]][[bar ]]
        ----- selection after ------
        [[foo]][[bar ┃]]

        ===== position  14 =========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo]][[bar]┃]
        ----- markdown  after ------
        [[foo]][[bar] ]
        ----- selection after ------
        [[foo]][[bar] ┃]

        ===== position  15 =========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo]][[bar]]┃
        ----- markdown  after ------
        [[foo]][[bar]]
        ----- selection after ------
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
        ===== position  1 ==========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        ┃[[foo]][[bar]]
        ----- markdown  after ------
        [[foo]][[bar]]
        ----- selection after ------

        ┃[[foo]][[bar]]

        ===== position  2 ==========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [┃[foo]][[bar]]
        ----- markdown  after ------
        [

        [foo]][[bar]]
        ----- selection after ------
        [
        ┃[foo]][[bar]]

        ===== position  3 ==========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[┃foo]][[bar]]
        ----- markdown  after ------
        [[

        foo]][[bar]]
        ----- selection after ------
        [[
        ┃foo]][[bar]]

        ===== position  4 ==========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[f┃oo]][[bar]]
        ----- markdown  after ------
        [[f

        oo]][[bar]]
        ----- selection after ------
        [[f
        ┃oo]][[bar]]

        ===== position  5 ==========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[fo┃o]][[bar]]
        ----- markdown  after ------
        [[fo

        o]][[bar]]
        ----- selection after ------
        [[fo
        ┃o]][[bar]]

        ===== position  6 ==========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo┃]][[bar]]
        ----- markdown  after ------
        [[foo

        ]][[bar]]
        ----- selection after ------
        [[foo
        ┃]][[bar]]

        ===== position  7 ==========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo]┃][[bar]]
        ----- markdown  after ------
        [[foo]

        ][[bar]]
        ----- selection after ------
        [[foo]
        ┃][[bar]]

        ===== position  8 ==========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo]]┃[[bar]]
        ----- markdown  after ------
        [[foo]]

        [[bar]]
        ----- selection after ------
        [[foo]]
        ┃[[bar]]

        ===== position  9 ==========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo]][┃[bar]]
        ----- markdown  after ------
        [[foo]][

        [bar]]
        ----- selection after ------
        [[foo]][
        ┃[bar]]

        ===== position  10 =========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo]][[┃bar]]
        ----- markdown  after ------
        [[foo]][[

        bar]]
        ----- selection after ------
        [[foo]][[
        ┃bar]]

        ===== position  11 =========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo]][[b┃ar]]
        ----- markdown  after ------
        [[foo]][[b

        ar]]
        ----- selection after ------
        [[foo]][[b
        ┃ar]]

        ===== position  12 =========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo]][[ba┃r]]
        ----- markdown  after ------
        [[foo]][[ba

        r]]
        ----- selection after ------
        [[foo]][[ba
        ┃r]]

        ===== position  13 =========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo]][[bar┃]]
        ----- markdown  after ------
        [[foo]][[bar

        ]]
        ----- selection after ------
        [[foo]][[bar
        ┃]]

        ===== position  14 =========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo]][[bar]┃]
        ----- markdown  after ------
        [[foo]][[bar]

        ]
        ----- selection after ------
        [[foo]][[bar]
        ┃]

        ===== position  15 =========
        ----- markdown  before -----
        [[foo]][[bar]]
        ----- selection before -----
        [[foo]][[bar]]┃
        ----- markdown  after ------
        [[foo]][[bar]]
        ----- selection after ------
        [[foo]][[bar]]
        ┃
        """
      `)
    },

  )
})
