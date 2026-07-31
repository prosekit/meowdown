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
    .split('\n')
    .map((line) => line.replace(/ +$/, (spaces) => '·'.repeat(spaces.length)))
    .join('\n')
}

// Press `key` once at every caret position of `markdown`. Each position records
// the selection before and after the press, then the markdown the document
// serializes to, which is where a lost list level or a dissolved wikilink shows
// up.
async function run(mode: MarkMode, markdown: string, key: string): Promise<string> {
  const cases: string[] = []
  for (const pos of findCaretPositions(markdownToDoc(markdown))) {
    using fixture = setupFixture({ extensionOptions: { markMode: mode } })
    fixture.set(markdownToDoc(markdown, { nodes: fixture.editor.nodes }))
    fixture.view.dispatch(fixture.state.tr.setSelection(TextSelection.create(fixture.doc, pos)))
    fixture.view.focus()
    await expect.element(pmRoot).toBeVisible()

    const markdownBefore = revealTrailingSpaces(docToMarkdown(fixture.doc) )
    const selectionbefore = revealTrailingSpaces(getSelectionSnapshot(fixture.state))

    await userEvent.keyboard(key)

    const markdownAfter = revealTrailingSpaces(
      docToMarkdown(fixture.doc)
    )
    const selectionAfter = revealTrailingSpaces(getSelectionSnapshot(fixture.state))

    cases.push(
      [
        getSplitline(`=`, `pos: ${pos}`),

        getSplitline(`-`, `markdown before`),
        markdownBefore,
        getSplitline(`-`, `markdown after`),
        markdownAfter,

        getSplitline(`-`, `selection before`),
        selectionbefore,
        getSplitline(`-`, `selection after`),
        selectionAfter,

        getSplitline('-'),
      ].join('\n'),
    )
  }
  return cases.join('\n\n')
}

function getSplitline(
  char: string,
  label: string = '',
  labelLength: number = 18,
  prefixLength = 5,
): string {
  if (label) {
    return (
      char.repeat(prefixLength) +
      (' ' + label + ' ').padEnd(labelLength, char) +
      char.repeat(prefixLength)
    )
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
  it('records Backspace at every caret position', async () => {
    expect(await run('focus', OUTLINE_MARKDOWN, '{Backspace}')).toMatchInlineSnapshot(`
      """
      ===== pos: 2 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      top

      - [[foo]]
      - [[bar]]

      ----- selection before -----
      ┃top
      [[foo]]
      [[bar]]
      ----- selection after ------
      ┃top
      [[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 3 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - op
        - [[foo]]
        - [[bar]]

      ----- selection before -----
      t┃op
      [[foo]]
      [[bar]]
      ----- selection after ------
      ┃op
      [[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 4 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - tp
        - [[foo]]
        - [[bar]]

      ----- selection before -----
      to┃p
      [[foo]]
      [[bar]]
      ----- selection after ------
      t┃p
      [[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 5 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - to
        - [[foo]]
        - [[bar]]

      ----- selection before -----
      top┃
      [[foo]]
      [[bar]]
      ----- selection after ------
      to┃
      [[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 8 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top

        [[foo]]

        - [[bar]]

      ----- selection before -----
      top
      ┃[[foo]]
      [[bar]]
      ----- selection after ------
      top
      ┃[[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 9 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [foo]]
        - [[bar]]

      ----- selection before -----
      top
      [┃[foo]]
      [[bar]]
      ----- selection after ------
      top
      ┃[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 10 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [foo]]
        - [[bar]]

      ----- selection before -----
      top
      [[┃foo]]
      [[bar]]
      ----- selection after ------
      top
      [┃foo]]
      [[bar]]
      ----------------------------

      ===== pos: 11 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[oo]]
        - [[bar]]

      ----- selection before -----
      top
      [[f┃oo]]
      [[bar]]
      ----- selection after ------
      top
      [[┃oo]]
      [[bar]]
      ----------------------------

      ===== pos: 12 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[fo]]
        - [[bar]]

      ----- selection before -----
      top
      [[fo┃o]]
      [[bar]]
      ----- selection after ------
      top
      [[f┃o]]
      [[bar]]
      ----------------------------

      ===== pos: 13 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[fo]]
        - [[bar]]

      ----- selection before -----
      top
      [[foo┃]]
      [[bar]]
      ----- selection after ------
      top
      [[fo┃]]
      [[bar]]
      ----------------------------

      ===== pos: 14 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]
        - [[bar]]

      ----- selection before -----
      top
      [[foo]┃]
      [[bar]]
      ----- selection after ------
      top
      [[foo┃]
      [[bar]]
      ----------------------------

      ===== pos: 15 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        -
        - [[bar]]

      ----- selection before -----
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------
      top
      ┃
      [[bar]]
      ----------------------------

      ===== pos: 19 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top

        - [[foo]]

        [[bar]]

      ----- selection before -----
      top
      [[foo]]
      ┃[[bar]]
      ----- selection after ------
      top
      [[foo]]
      ┃[[bar]]
      ----------------------------

      ===== pos: 20 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [bar]]

      ----- selection before -----
      top
      [[foo]]
      [┃[bar]]
      ----- selection after ------
      top
      [[foo]]
      ┃[bar]]
      ----------------------------

      ===== pos: 21 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [bar]]

      ----- selection before -----
      top
      [[foo]]
      [[┃bar]]
      ----- selection after ------
      top
      [[foo]]
      [┃bar]]
      ----------------------------

      ===== pos: 22 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[ar]]

      ----- selection before -----
      top
      [[foo]]
      [[b┃ar]]
      ----- selection after ------
      top
      [[foo]]
      [[┃ar]]
      ----------------------------

      ===== pos: 23 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[br]]

      ----- selection before -----
      top
      [[foo]]
      [[ba┃r]]
      ----- selection after ------
      top
      [[foo]]
      [[b┃r]]
      ----------------------------

      ===== pos: 24 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[ba]]

      ----- selection before -----
      top
      [[foo]]
      [[bar┃]]
      ----- selection after ------
      top
      [[foo]]
      [[ba┃]]
      ----------------------------

      ===== pos: 25 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[bar]

      ----- selection before -----
      top
      [[foo]]
      [[bar]┃]
      ----- selection after ------
      top
      [[foo]]
      [[bar┃]
      ----------------------------

      ===== pos: 26 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        -

      ----- selection before -----
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------
      top
      [[foo]]
      ┃
      ----------------------------
      """
    `)
  })

  it('records Space at every caret position', async () => {
    expect(await run('focus', OUTLINE_MARKDOWN, ' ')).toMatchInlineSnapshot(`
      """
      ===== pos: 2 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      -  top
        - [[foo]]
        - [[bar]]

      ----- selection before -----
      ┃top
      [[foo]]
      [[bar]]
      ----- selection after ------
       ┃top
      [[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 3 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - t op
        - [[foo]]
        - [[bar]]

      ----- selection before -----
      t┃op
      [[foo]]
      [[bar]]
      ----- selection after ------
      t ┃op
      [[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 4 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - to p
        - [[foo]]
        - [[bar]]

      ----- selection before -----
      to┃p
      [[foo]]
      [[bar]]
      ----- selection after ------
      to ┃p
      [[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 5 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top·
        - [[foo]]
        - [[bar]]

      ----- selection before -----
      top┃
      [[foo]]
      [[bar]]
      ----- selection after ------
      top ┃
      [[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 8 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        -  [[foo]]
        - [[bar]]

      ----- selection before -----
      top
      ┃[[foo]]
      [[bar]]
      ----- selection after ------
      top
       ┃[[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 9 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [ [foo]]
        - [[bar]]

      ----- selection before -----
      top
      [┃[foo]]
      [[bar]]
      ----- selection after ------
      top
      [ ┃[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 10 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[ foo]]
        - [[bar]]

      ----- selection before -----
      top
      [[┃foo]]
      [[bar]]
      ----- selection after ------
      top
      [[ ┃foo]]
      [[bar]]
      ----------------------------

      ===== pos: 11 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[f oo]]
        - [[bar]]

      ----- selection before -----
      top
      [[f┃oo]]
      [[bar]]
      ----- selection after ------
      top
      [[f ┃oo]]
      [[bar]]
      ----------------------------

      ===== pos: 12 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[fo o]]
        - [[bar]]

      ----- selection before -----
      top
      [[fo┃o]]
      [[bar]]
      ----- selection after ------
      top
      [[fo ┃o]]
      [[bar]]
      ----------------------------

      ===== pos: 13 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo ]]
        - [[bar]]

      ----- selection before -----
      top
      [[foo┃]]
      [[bar]]
      ----- selection after ------
      top
      [[foo ┃]]
      [[bar]]
      ----------------------------

      ===== pos: 14 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo] ]
        - [[bar]]

      ----- selection before -----
      top
      [[foo]┃]
      [[bar]]
      ----- selection after ------
      top
      [[foo] ┃]
      [[bar]]
      ----------------------------

      ===== pos: 15 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]·
        - [[bar]]

      ----- selection before -----
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------
      top
      [[foo]] ┃
      [[bar]]
      ----------------------------

      ===== pos: 19 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        -  [[bar]]

      ----- selection before -----
      top
      [[foo]]
      ┃[[bar]]
      ----- selection after ------
      top
      [[foo]]
       ┃[[bar]]
      ----------------------------

      ===== pos: 20 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [ [bar]]

      ----- selection before -----
      top
      [[foo]]
      [┃[bar]]
      ----- selection after ------
      top
      [[foo]]
      [ ┃[bar]]
      ----------------------------

      ===== pos: 21 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[ bar]]

      ----- selection before -----
      top
      [[foo]]
      [[┃bar]]
      ----- selection after ------
      top
      [[foo]]
      [[ ┃bar]]
      ----------------------------

      ===== pos: 22 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[b ar]]

      ----- selection before -----
      top
      [[foo]]
      [[b┃ar]]
      ----- selection after ------
      top
      [[foo]]
      [[b ┃ar]]
      ----------------------------

      ===== pos: 23 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[ba r]]

      ----- selection before -----
      top
      [[foo]]
      [[ba┃r]]
      ----- selection after ------
      top
      [[foo]]
      [[ba ┃r]]
      ----------------------------

      ===== pos: 24 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[bar ]]

      ----- selection before -----
      top
      [[foo]]
      [[bar┃]]
      ----- selection after ------
      top
      [[foo]]
      [[bar ┃]]
      ----------------------------

      ===== pos: 25 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[bar] ]

      ----- selection before -----
      top
      [[foo]]
      [[bar]┃]
      ----- selection after ------
      top
      [[foo]]
      [[bar] ┃]
      ----------------------------

      ===== pos: 26 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[bar]]

      ----- selection before -----
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------
      top
      [[foo]]
      [[bar]] ┃
      ----------------------------
      """
    `)
  })

  it('records Enter at every caret position', async () => {
    expect(await run('focus', OUTLINE_MARKDOWN, '{Enter}')).toMatchInlineSnapshot(`
      """
      ===== pos: 2 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      -
      - top
        - [[foo]]
        - [[bar]]

      ----- selection before -----
      ┃top
      [[foo]]
      [[bar]]
      ----- selection after ------

      ┃top
      [[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 3 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - t
      - op
        - [[foo]]
        - [[bar]]

      ----- selection before -----
      t┃op
      [[foo]]
      [[bar]]
      ----- selection after ------
      t
      ┃op
      [[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 4 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - to
      - p
        - [[foo]]
        - [[bar]]

      ----- selection before -----
      to┃p
      [[foo]]
      [[bar]]
      ----- selection after ------
      to
      ┃p
      [[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 5 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
      -
        - [[foo]]
        - [[bar]]

      ----- selection before -----
      top┃
      [[foo]]
      [[bar]]
      ----- selection after ------
      top
      ┃
      [[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 8 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        -
        - [[foo]]
        - [[bar]]

      ----- selection before -----
      top
      ┃[[foo]]
      [[bar]]
      ----- selection after ------
      top

      ┃[[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 9 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [
        - [foo]]
        - [[bar]]

      ----- selection before -----
      top
      [┃[foo]]
      [[bar]]
      ----- selection after ------
      top
      [
      ┃[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 10 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[
        - foo]]
        - [[bar]]

      ----- selection before -----
      top
      [[┃foo]]
      [[bar]]
      ----- selection after ------
      top
      [[
      ┃foo]]
      [[bar]]
      ----------------------------

      ===== pos: 11 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[f
        - oo]]
        - [[bar]]

      ----- selection before -----
      top
      [[f┃oo]]
      [[bar]]
      ----- selection after ------
      top
      [[f
      ┃oo]]
      [[bar]]
      ----------------------------

      ===== pos: 12 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[fo
        - o]]
        - [[bar]]

      ----- selection before -----
      top
      [[fo┃o]]
      [[bar]]
      ----- selection after ------
      top
      [[fo
      ┃o]]
      [[bar]]
      ----------------------------

      ===== pos: 13 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo
        - ]]
        - [[bar]]

      ----- selection before -----
      top
      [[foo┃]]
      [[bar]]
      ----- selection after ------
      top
      [[foo
      ┃]]
      [[bar]]
      ----------------------------

      ===== pos: 14 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]
        - ]
        - [[bar]]

      ----- selection before -----
      top
      [[foo]┃]
      [[bar]]
      ----- selection after ------
      top
      [[foo]
      ┃]
      [[bar]]
      ----------------------------

      ===== pos: 15 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        -
        - [[bar]]

      ----- selection before -----
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------
      top
      [[foo]]
      ┃
      [[bar]]
      ----------------------------

      ===== pos: 19 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        -
        - [[bar]]

      ----- selection before -----
      top
      [[foo]]
      ┃[[bar]]
      ----- selection after ------
      top
      [[foo]]

      ┃[[bar]]
      ----------------------------

      ===== pos: 20 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [
        - [bar]]

      ----- selection before -----
      top
      [[foo]]
      [┃[bar]]
      ----- selection after ------
      top
      [[foo]]
      [
      ┃[bar]]
      ----------------------------

      ===== pos: 21 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[
        - bar]]

      ----- selection before -----
      top
      [[foo]]
      [[┃bar]]
      ----- selection after ------
      top
      [[foo]]
      [[
      ┃bar]]
      ----------------------------

      ===== pos: 22 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[b
        - ar]]

      ----- selection before -----
      top
      [[foo]]
      [[b┃ar]]
      ----- selection after ------
      top
      [[foo]]
      [[b
      ┃ar]]
      ----------------------------

      ===== pos: 23 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[ba
        - r]]

      ----- selection before -----
      top
      [[foo]]
      [[ba┃r]]
      ----- selection after ------
      top
      [[foo]]
      [[ba
      ┃r]]
      ----------------------------

      ===== pos: 24 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[bar
        - ]]

      ----- selection before -----
      top
      [[foo]]
      [[bar┃]]
      ----- selection after ------
      top
      [[foo]]
      [[bar
      ┃]]
      ----------------------------

      ===== pos: 25 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[bar]
        - ]

      ----- selection before -----
      top
      [[foo]]
      [[bar]┃]
      ----- selection after ------
      top
      [[foo]]
      [[bar]
      ┃]
      ----------------------------

      ===== pos: 26 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[bar]]
        -

      ----- selection before -----
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------
      top
      [[foo]]
      [[bar]]
      ┃
      ----------------------------
      """
    `)
  })
})

describe('caret fuzz over a wikilink outline in hide mode', () => {
  it('records Backspace at every caret position', async () => {
    expect(await run('hide', OUTLINE_MARKDOWN, '{Backspace}')).toMatchInlineSnapshot(`
      """
      ===== pos: 2 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      top

      - [[foo]]
      - [[bar]]

      ----- selection before -----
      ┃top
      [[foo]]
      [[bar]]
      ----- selection after ------
      ┃top
      [[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 3 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - op
        - [[foo]]
        - [[bar]]

      ----- selection before -----
      t┃op
      [[foo]]
      [[bar]]
      ----- selection after ------
      ┃op
      [[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 4 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - tp
        - [[foo]]
        - [[bar]]

      ----- selection before -----
      to┃p
      [[foo]]
      [[bar]]
      ----- selection after ------
      t┃p
      [[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 5 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - to
        - [[foo]]
        - [[bar]]

      ----- selection before -----
      top┃
      [[foo]]
      [[bar]]
      ----- selection after ------
      to┃
      [[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 8 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top

        [[foo]]

        - [[bar]]

      ----- selection before -----
      top
      ┃[[foo]]
      [[bar]]
      ----- selection after ------
      top
      ┃[[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 9 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [foo]]
        - [[bar]]

      ----- selection before -----
      top
      [┃[foo]]
      [[bar]]
      ----- selection after ------
      top
      ┃[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 10 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [foo]]
        - [[bar]]

      ----- selection before -----
      top
      [[┃foo]]
      [[bar]]
      ----- selection after ------
      top
      [┃foo]]
      [[bar]]
      ----------------------------

      ===== pos: 11 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[oo]]
        - [[bar]]

      ----- selection before -----
      top
      [[f┃oo]]
      [[bar]]
      ----- selection after ------
      top
      [[┃oo]]
      [[bar]]
      ----------------------------

      ===== pos: 12 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[fo]]
        - [[bar]]

      ----- selection before -----
      top
      [[fo┃o]]
      [[bar]]
      ----- selection after ------
      top
      [[f┃o]]
      [[bar]]
      ----------------------------

      ===== pos: 13 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[fo]]
        - [[bar]]

      ----- selection before -----
      top
      [[foo┃]]
      [[bar]]
      ----- selection after ------
      top
      [[fo┃]]
      [[bar]]
      ----------------------------

      ===== pos: 14 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]
        - [[bar]]

      ----- selection before -----
      top
      [[foo]┃]
      [[bar]]
      ----- selection after ------
      top
      [[foo┃]
      [[bar]]
      ----------------------------

      ===== pos: 15 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        -
        - [[bar]]

      ----- selection before -----
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------
      top
      ┃
      [[bar]]
      ----------------------------

      ===== pos: 19 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top

        - [[foo]]

        [[bar]]

      ----- selection before -----
      top
      [[foo]]
      ┃[[bar]]
      ----- selection after ------
      top
      [[foo]]
      ┃[[bar]]
      ----------------------------

      ===== pos: 20 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [bar]]

      ----- selection before -----
      top
      [[foo]]
      [┃[bar]]
      ----- selection after ------
      top
      [[foo]]
      ┃[bar]]
      ----------------------------

      ===== pos: 21 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [bar]]

      ----- selection before -----
      top
      [[foo]]
      [[┃bar]]
      ----- selection after ------
      top
      [[foo]]
      [┃bar]]
      ----------------------------

      ===== pos: 22 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[ar]]

      ----- selection before -----
      top
      [[foo]]
      [[b┃ar]]
      ----- selection after ------
      top
      [[foo]]
      [[┃ar]]
      ----------------------------

      ===== pos: 23 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[br]]

      ----- selection before -----
      top
      [[foo]]
      [[ba┃r]]
      ----- selection after ------
      top
      [[foo]]
      [[b┃r]]
      ----------------------------

      ===== pos: 24 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[ba]]

      ----- selection before -----
      top
      [[foo]]
      [[bar┃]]
      ----- selection after ------
      top
      [[foo]]
      [[ba┃]]
      ----------------------------

      ===== pos: 25 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[bar]

      ----- selection before -----
      top
      [[foo]]
      [[bar]┃]
      ----- selection after ------
      top
      [[foo]]
      [[bar┃]
      ----------------------------

      ===== pos: 26 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        -

      ----- selection before -----
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------
      top
      [[foo]]
      ┃
      ----------------------------
      """
    `)
  })

  it('records Space at every caret position', async () => {
    expect(await run('hide', OUTLINE_MARKDOWN, ' ')).toMatchInlineSnapshot(`
      """
      ===== pos: 2 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      -  top
        - [[foo]]
        - [[bar]]

      ----- selection before -----
      ┃top
      [[foo]]
      [[bar]]
      ----- selection after ------
       ┃top
      [[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 3 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - t op
        - [[foo]]
        - [[bar]]

      ----- selection before -----
      t┃op
      [[foo]]
      [[bar]]
      ----- selection after ------
      t ┃op
      [[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 4 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - to p
        - [[foo]]
        - [[bar]]

      ----- selection before -----
      to┃p
      [[foo]]
      [[bar]]
      ----- selection after ------
      to ┃p
      [[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 5 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top·
        - [[foo]]
        - [[bar]]

      ----- selection before -----
      top┃
      [[foo]]
      [[bar]]
      ----- selection after ------
      top ┃
      [[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 8 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        -  [[foo]]
        - [[bar]]

      ----- selection before -----
      top
      ┃[[foo]]
      [[bar]]
      ----- selection after ------
      top
       ┃[[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 9 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [ [foo]]
        - [[bar]]

      ----- selection before -----
      top
      [┃[foo]]
      [[bar]]
      ----- selection after ------
      top
      [ ┃[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 10 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[ foo]]
        - [[bar]]

      ----- selection before -----
      top
      [[┃foo]]
      [[bar]]
      ----- selection after ------
      top
      [[ ┃foo]]
      [[bar]]
      ----------------------------

      ===== pos: 11 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[f oo]]
        - [[bar]]

      ----- selection before -----
      top
      [[f┃oo]]
      [[bar]]
      ----- selection after ------
      top
      [[f ┃oo]]
      [[bar]]
      ----------------------------

      ===== pos: 12 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[fo o]]
        - [[bar]]

      ----- selection before -----
      top
      [[fo┃o]]
      [[bar]]
      ----- selection after ------
      top
      [[fo ┃o]]
      [[bar]]
      ----------------------------

      ===== pos: 13 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo ]]
        - [[bar]]

      ----- selection before -----
      top
      [[foo┃]]
      [[bar]]
      ----- selection after ------
      top
      [[foo ┃]]
      [[bar]]
      ----------------------------

      ===== pos: 14 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo] ]
        - [[bar]]

      ----- selection before -----
      top
      [[foo]┃]
      [[bar]]
      ----- selection after ------
      top
      [[foo] ┃]
      [[bar]]
      ----------------------------

      ===== pos: 15 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]·
        - [[bar]]

      ----- selection before -----
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------
      top
      [[foo]] ┃
      [[bar]]
      ----------------------------

      ===== pos: 19 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        -  [[bar]]

      ----- selection before -----
      top
      [[foo]]
      ┃[[bar]]
      ----- selection after ------
      top
      [[foo]]
       ┃[[bar]]
      ----------------------------

      ===== pos: 20 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [ [bar]]

      ----- selection before -----
      top
      [[foo]]
      [┃[bar]]
      ----- selection after ------
      top
      [[foo]]
      [ ┃[bar]]
      ----------------------------

      ===== pos: 21 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[ bar]]

      ----- selection before -----
      top
      [[foo]]
      [[┃bar]]
      ----- selection after ------
      top
      [[foo]]
      [[ ┃bar]]
      ----------------------------

      ===== pos: 22 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[b ar]]

      ----- selection before -----
      top
      [[foo]]
      [[b┃ar]]
      ----- selection after ------
      top
      [[foo]]
      [[b ┃ar]]
      ----------------------------

      ===== pos: 23 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[ba r]]

      ----- selection before -----
      top
      [[foo]]
      [[ba┃r]]
      ----- selection after ------
      top
      [[foo]]
      [[ba ┃r]]
      ----------------------------

      ===== pos: 24 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[bar ]]

      ----- selection before -----
      top
      [[foo]]
      [[bar┃]]
      ----- selection after ------
      top
      [[foo]]
      [[bar ┃]]
      ----------------------------

      ===== pos: 25 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[bar] ]

      ----- selection before -----
      top
      [[foo]]
      [[bar]┃]
      ----- selection after ------
      top
      [[foo]]
      [[bar] ┃]
      ----------------------------

      ===== pos: 26 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[bar]]

      ----- selection before -----
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------
      top
      [[foo]]
      [[bar]] ┃
      ----------------------------
      """
    `)
  })

  it('records Enter at every caret position', async () => {
    expect(await run('hide', OUTLINE_MARKDOWN, '{Enter}')).toMatchInlineSnapshot(`
      """
      ===== pos: 2 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      -
      - top
        - [[foo]]
        - [[bar]]

      ----- selection before -----
      ┃top
      [[foo]]
      [[bar]]
      ----- selection after ------

      ┃top
      [[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 3 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - t
      - op
        - [[foo]]
        - [[bar]]

      ----- selection before -----
      t┃op
      [[foo]]
      [[bar]]
      ----- selection after ------
      t
      ┃op
      [[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 4 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - to
      - p
        - [[foo]]
        - [[bar]]

      ----- selection before -----
      to┃p
      [[foo]]
      [[bar]]
      ----- selection after ------
      to
      ┃p
      [[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 5 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
      -
        - [[foo]]
        - [[bar]]

      ----- selection before -----
      top┃
      [[foo]]
      [[bar]]
      ----- selection after ------
      top
      ┃
      [[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 8 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        -
        - [[foo]]
        - [[bar]]

      ----- selection before -----
      top
      ┃[[foo]]
      [[bar]]
      ----- selection after ------
      top

      ┃[[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 9 ===============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [
        - [foo]]
        - [[bar]]

      ----- selection before -----
      top
      [┃[foo]]
      [[bar]]
      ----- selection after ------
      top
      [
      ┃[foo]]
      [[bar]]
      ----------------------------

      ===== pos: 10 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[
        - foo]]
        - [[bar]]

      ----- selection before -----
      top
      [[┃foo]]
      [[bar]]
      ----- selection after ------
      top
      [[
      ┃foo]]
      [[bar]]
      ----------------------------

      ===== pos: 11 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[f
        - oo]]
        - [[bar]]

      ----- selection before -----
      top
      [[f┃oo]]
      [[bar]]
      ----- selection after ------
      top
      [[f
      ┃oo]]
      [[bar]]
      ----------------------------

      ===== pos: 12 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[fo
        - o]]
        - [[bar]]

      ----- selection before -----
      top
      [[fo┃o]]
      [[bar]]
      ----- selection after ------
      top
      [[fo
      ┃o]]
      [[bar]]
      ----------------------------

      ===== pos: 13 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo
        - ]]
        - [[bar]]

      ----- selection before -----
      top
      [[foo┃]]
      [[bar]]
      ----- selection after ------
      top
      [[foo
      ┃]]
      [[bar]]
      ----------------------------

      ===== pos: 14 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]
        - ]
        - [[bar]]

      ----- selection before -----
      top
      [[foo]┃]
      [[bar]]
      ----- selection after ------
      top
      [[foo]
      ┃]
      [[bar]]
      ----------------------------

      ===== pos: 15 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        -
        - [[bar]]

      ----- selection before -----
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------
      top
      [[foo]]
      ┃
      [[bar]]
      ----------------------------

      ===== pos: 19 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        -
        - [[bar]]

      ----- selection before -----
      top
      [[foo]]
      ┃[[bar]]
      ----- selection after ------
      top
      [[foo]]

      ┃[[bar]]
      ----------------------------

      ===== pos: 20 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [
        - [bar]]

      ----- selection before -----
      top
      [[foo]]
      [┃[bar]]
      ----- selection after ------
      top
      [[foo]]
      [
      ┃[bar]]
      ----------------------------

      ===== pos: 21 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[
        - bar]]

      ----- selection before -----
      top
      [[foo]]
      [[┃bar]]
      ----- selection after ------
      top
      [[foo]]
      [[
      ┃bar]]
      ----------------------------

      ===== pos: 22 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[b
        - ar]]

      ----- selection before -----
      top
      [[foo]]
      [[b┃ar]]
      ----- selection after ------
      top
      [[foo]]
      [[b
      ┃ar]]
      ----------------------------

      ===== pos: 23 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[ba
        - r]]

      ----- selection before -----
      top
      [[foo]]
      [[ba┃r]]
      ----- selection after ------
      top
      [[foo]]
      [[ba
      ┃r]]
      ----------------------------

      ===== pos: 24 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[bar
        - ]]

      ----- selection before -----
      top
      [[foo]]
      [[bar┃]]
      ----- selection after ------
      top
      [[foo]]
      [[bar
      ┃]]
      ----------------------------

      ===== pos: 25 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[bar]
        - ]

      ----- selection before -----
      top
      [[foo]]
      [[bar]┃]
      ----- selection after ------
      top
      [[foo]]
      [[bar]
      ┃]
      ----------------------------

      ===== pos: 26 ==============
      ----- markdown before ------
      - top
        - [[foo]]
        - [[bar]]

      ----- markdown after -------
      - top
        - [[foo]]
        - [[bar]]
        -

      ----- selection before -----
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------
      top
      [[foo]]
      [[bar]]
      ┃
      ----------------------------
      """
    `)
  })
})

describe('caret fuzz over a wikilink inside a paragraph in focus mode', () => {
  it('records Backspace at every caret position', async () => {
    expect(await run('focus', INLINE_MARKDOWN, '{Backspace}')).toMatchInlineSnapshot(`
      """
      ===== pos: 1 ===============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a [[foo]] b

      ----- selection before -----
      ┃a [[foo]] b
      ----- selection after ------
      ┃a [[foo]] b
      ----------------------------

      ===== pos: 2 ===============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
       [[foo]] b

      ----- selection before -----
      a┃ [[foo]] b
      ----- selection after ------
      ┃ [[foo]] b
      ----------------------------

      ===== pos: 3 ===============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a[[foo]] b

      ----- selection before -----
      a ┃[[foo]] b
      ----- selection after ------
      a┃[[foo]] b
      ----------------------------

      ===== pos: 4 ===============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a [foo]] b

      ----- selection before -----
      a [┃[foo]] b
      ----- selection after ------
      a ┃[foo]] b
      ----------------------------

      ===== pos: 5 ===============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a [foo]] b

      ----- selection before -----
      a [[┃foo]] b
      ----- selection after ------
      a [┃foo]] b
      ----------------------------

      ===== pos: 6 ===============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a [[oo]] b

      ----- selection before -----
      a [[f┃oo]] b
      ----- selection after ------
      a [[┃oo]] b
      ----------------------------

      ===== pos: 7 ===============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a [[fo]] b

      ----- selection before -----
      a [[fo┃o]] b
      ----- selection after ------
      a [[f┃o]] b
      ----------------------------

      ===== pos: 8 ===============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a [[fo]] b

      ----- selection before -----
      a [[foo┃]] b
      ----- selection after ------
      a [[fo┃]] b
      ----------------------------

      ===== pos: 9 ===============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a [[foo] b

      ----- selection before -----
      a [[foo]┃] b
      ----- selection after ------
      a [[foo┃] b
      ----------------------------

      ===== pos: 10 ==============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a  b

      ----- selection before -----
      a [[foo]]┃ b
      ----- selection after ------
      a ┃ b
      ----------------------------

      ===== pos: 11 ==============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a [[foo]]b

      ----- selection before -----
      a [[foo]] ┃b
      ----- selection after ------
      a [[foo]]┃b
      ----------------------------

      ===== pos: 12 ==============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a [[foo]]

      ----- selection before -----
      a [[foo]] b┃
      ----- selection after ------
      a [[foo]] ┃
      ----------------------------
      """
    `)
  })

  it('records Space at every caret position', async () => {
    expect(await run('focus', INLINE_MARKDOWN, ' ')).toMatchInlineSnapshot(`
      """
      ===== pos: 1 ===============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
       a [[foo]] b

      ----- selection before -----
      ┃a [[foo]] b
      ----- selection after ------
       ┃a [[foo]] b
      ----------------------------

      ===== pos: 2 ===============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a  [[foo]] b

      ----- selection before -----
      a┃ [[foo]] b
      ----- selection after ------
      a ┃ [[foo]] b
      ----------------------------

      ===== pos: 3 ===============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a  [[foo]] b

      ----- selection before -----
      a ┃[[foo]] b
      ----- selection after ------
      a  ┃[[foo]] b
      ----------------------------

      ===== pos: 4 ===============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a [ [foo]] b

      ----- selection before -----
      a [┃[foo]] b
      ----- selection after ------
      a [ ┃[foo]] b
      ----------------------------

      ===== pos: 5 ===============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a [[ foo]] b

      ----- selection before -----
      a [[┃foo]] b
      ----- selection after ------
      a [[ ┃foo]] b
      ----------------------------

      ===== pos: 6 ===============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a [[f oo]] b

      ----- selection before -----
      a [[f┃oo]] b
      ----- selection after ------
      a [[f ┃oo]] b
      ----------------------------

      ===== pos: 7 ===============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a [[fo o]] b

      ----- selection before -----
      a [[fo┃o]] b
      ----- selection after ------
      a [[fo ┃o]] b
      ----------------------------

      ===== pos: 8 ===============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a [[foo ]] b

      ----- selection before -----
      a [[foo┃]] b
      ----- selection after ------
      a [[foo ┃]] b
      ----------------------------

      ===== pos: 9 ===============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a [[foo] ] b

      ----- selection before -----
      a [[foo]┃] b
      ----- selection after ------
      a [[foo] ┃] b
      ----------------------------

      ===== pos: 10 ==============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a [[foo]]  b

      ----- selection before -----
      a [[foo]]┃ b
      ----- selection after ------
      a [[foo]] ┃ b
      ----------------------------

      ===== pos: 11 ==============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a [[foo]]  b

      ----- selection before -----
      a [[foo]] ┃b
      ----- selection after ------
      a [[foo]]  ┃b
      ----------------------------

      ===== pos: 12 ==============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a [[foo]] b

      ----- selection before -----
      a [[foo]] b┃
      ----- selection after ------
      a [[foo]] b ┃
      ----------------------------
      """
    `)
  })

  it('records Enter at every caret position', async () => {
    expect(await run('focus', INLINE_MARKDOWN, '{Enter}')).toMatchInlineSnapshot(`
      """
      ===== pos: 1 ===============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a [[foo]] b

      ----- selection before -----
      ┃a [[foo]] b
      ----- selection after ------

      ┃a [[foo]] b
      ----------------------------

      ===== pos: 2 ===============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a

       [[foo]] b

      ----- selection before -----
      a┃ [[foo]] b
      ----- selection after ------
      a
      ┃ [[foo]] b
      ----------------------------

      ===== pos: 3 ===============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a·

      [[foo]] b

      ----- selection before -----
      a ┃[[foo]] b
      ----- selection after ------
      a·
      ┃[[foo]] b
      ----------------------------

      ===== pos: 4 ===============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a [

      [foo]] b

      ----- selection before -----
      a [┃[foo]] b
      ----- selection after ------
      a [
      ┃[foo]] b
      ----------------------------

      ===== pos: 5 ===============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a [[

      foo]] b

      ----- selection before -----
      a [[┃foo]] b
      ----- selection after ------
      a [[
      ┃foo]] b
      ----------------------------

      ===== pos: 6 ===============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a [[f

      oo]] b

      ----- selection before -----
      a [[f┃oo]] b
      ----- selection after ------
      a [[f
      ┃oo]] b
      ----------------------------

      ===== pos: 7 ===============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a [[fo

      o]] b

      ----- selection before -----
      a [[fo┃o]] b
      ----- selection after ------
      a [[fo
      ┃o]] b
      ----------------------------

      ===== pos: 8 ===============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a [[foo

      ]] b

      ----- selection before -----
      a [[foo┃]] b
      ----- selection after ------
      a [[foo
      ┃]] b
      ----------------------------

      ===== pos: 9 ===============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a [[foo]

      ] b

      ----- selection before -----
      a [[foo]┃] b
      ----- selection after ------
      a [[foo]
      ┃] b
      ----------------------------

      ===== pos: 10 ==============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a [[foo]]

       b

      ----- selection before -----
      a [[foo]]┃ b
      ----- selection after ------
      a [[foo]]
      ┃ b
      ----------------------------

      ===== pos: 11 ==============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a [[foo]]·

      b

      ----- selection before -----
      a [[foo]] ┃b
      ----- selection after ------
      a [[foo]]·
      ┃b
      ----------------------------

      ===== pos: 12 ==============
      ----- markdown before ------
      a [[foo]] b

      ----- markdown after -------
      a [[foo]] b

      ----- selection before -----
      a [[foo]] b┃
      ----- selection after ------
      a [[foo]] b
      ┃
      ----------------------------
      """
    `)
  })
})

describe('caret fuzz over two adjacent wikilinks in focus mode', () => {
  it('records Backspace at every caret position', async () => {
    expect(await run('focus', ADJACENT_MARKDOWN, '{Backspace}')).toMatchInlineSnapshot(`
      """
      ===== pos: 1 ===============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo]][[bar]]

      ----- selection before -----
      ┃[[foo]][[bar]]
      ----- selection after ------
      ┃[[foo]][[bar]]
      ----------------------------

      ===== pos: 2 ===============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [foo]][[bar]]

      ----- selection before -----
      [┃[foo]][[bar]]
      ----- selection after ------
      ┃[foo]][[bar]]
      ----------------------------

      ===== pos: 3 ===============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [foo]][[bar]]

      ----- selection before -----
      [[┃foo]][[bar]]
      ----- selection after ------
      [┃foo]][[bar]]
      ----------------------------

      ===== pos: 4 ===============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[oo]][[bar]]

      ----- selection before -----
      [[f┃oo]][[bar]]
      ----- selection after ------
      [[┃oo]][[bar]]
      ----------------------------

      ===== pos: 5 ===============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[fo]][[bar]]

      ----- selection before -----
      [[fo┃o]][[bar]]
      ----- selection after ------
      [[f┃o]][[bar]]
      ----------------------------

      ===== pos: 6 ===============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[fo]][[bar]]

      ----- selection before -----
      [[foo┃]][[bar]]
      ----- selection after ------
      [[fo┃]][[bar]]
      ----------------------------

      ===== pos: 7 ===============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo][[bar]]

      ----- selection before -----
      [[foo]┃][[bar]]
      ----- selection after ------
      [[foo┃][[bar]]
      ----------------------------

      ===== pos: 8 ===============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[bar]]

      ----- selection before -----
      [[foo]]┃[[bar]]
      ----- selection after ------
      ┃[[bar]]
      ----------------------------

      ===== pos: 9 ===============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo]][bar]]

      ----- selection before -----
      [[foo]][┃[bar]]
      ----- selection after ------
      [[foo]]┃[bar]]
      ----------------------------

      ===== pos: 10 ==============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo]][bar]]

      ----- selection before -----
      [[foo]][[┃bar]]
      ----- selection after ------
      [[foo]][┃bar]]
      ----------------------------

      ===== pos: 11 ==============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo]][[ar]]

      ----- selection before -----
      [[foo]][[b┃ar]]
      ----- selection after ------
      [[foo]][[┃ar]]
      ----------------------------

      ===== pos: 12 ==============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo]][[br]]

      ----- selection before -----
      [[foo]][[ba┃r]]
      ----- selection after ------
      [[foo]][[b┃r]]
      ----------------------------

      ===== pos: 13 ==============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo]][[ba]]

      ----- selection before -----
      [[foo]][[bar┃]]
      ----- selection after ------
      [[foo]][[ba┃]]
      ----------------------------

      ===== pos: 14 ==============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo]][[bar]

      ----- selection before -----
      [[foo]][[bar]┃]
      ----- selection after ------
      [[foo]][[bar┃]
      ----------------------------

      ===== pos: 15 ==============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo]]

      ----- selection before -----
      [[foo]][[bar]]┃
      ----- selection after ------
      [[foo]]┃
      ----------------------------
      """
    `)
  })

  it('records Space at every caret position', async () => {
    expect(await run('focus', ADJACENT_MARKDOWN, ' ')).toMatchInlineSnapshot(`
      """
      ===== pos: 1 ===============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
       [[foo]][[bar]]

      ----- selection before -----
      ┃[[foo]][[bar]]
      ----- selection after ------
       ┃[[foo]][[bar]]
      ----------------------------

      ===== pos: 2 ===============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [ [foo]][[bar]]

      ----- selection before -----
      [┃[foo]][[bar]]
      ----- selection after ------
      [ ┃[foo]][[bar]]
      ----------------------------

      ===== pos: 3 ===============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[ foo]][[bar]]

      ----- selection before -----
      [[┃foo]][[bar]]
      ----- selection after ------
      [[ ┃foo]][[bar]]
      ----------------------------

      ===== pos: 4 ===============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[f oo]][[bar]]

      ----- selection before -----
      [[f┃oo]][[bar]]
      ----- selection after ------
      [[f ┃oo]][[bar]]
      ----------------------------

      ===== pos: 5 ===============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[fo o]][[bar]]

      ----- selection before -----
      [[fo┃o]][[bar]]
      ----- selection after ------
      [[fo ┃o]][[bar]]
      ----------------------------

      ===== pos: 6 ===============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo ]][[bar]]

      ----- selection before -----
      [[foo┃]][[bar]]
      ----- selection after ------
      [[foo ┃]][[bar]]
      ----------------------------

      ===== pos: 7 ===============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo] ][[bar]]

      ----- selection before -----
      [[foo]┃][[bar]]
      ----- selection after ------
      [[foo] ┃][[bar]]
      ----------------------------

      ===== pos: 8 ===============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo]] [[bar]]

      ----- selection before -----
      [[foo]]┃[[bar]]
      ----- selection after ------
      [[foo]] ┃[[bar]]
      ----------------------------

      ===== pos: 9 ===============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo]][ [bar]]

      ----- selection before -----
      [[foo]][┃[bar]]
      ----- selection after ------
      [[foo]][ ┃[bar]]
      ----------------------------

      ===== pos: 10 ==============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo]][[ bar]]

      ----- selection before -----
      [[foo]][[┃bar]]
      ----- selection after ------
      [[foo]][[ ┃bar]]
      ----------------------------

      ===== pos: 11 ==============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo]][[b ar]]

      ----- selection before -----
      [[foo]][[b┃ar]]
      ----- selection after ------
      [[foo]][[b ┃ar]]
      ----------------------------

      ===== pos: 12 ==============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo]][[ba r]]

      ----- selection before -----
      [[foo]][[ba┃r]]
      ----- selection after ------
      [[foo]][[ba ┃r]]
      ----------------------------

      ===== pos: 13 ==============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo]][[bar ]]

      ----- selection before -----
      [[foo]][[bar┃]]
      ----- selection after ------
      [[foo]][[bar ┃]]
      ----------------------------

      ===== pos: 14 ==============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo]][[bar] ]

      ----- selection before -----
      [[foo]][[bar]┃]
      ----- selection after ------
      [[foo]][[bar] ┃]
      ----------------------------

      ===== pos: 15 ==============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo]][[bar]]

      ----- selection before -----
      [[foo]][[bar]]┃
      ----- selection after ------
      [[foo]][[bar]] ┃
      ----------------------------
      """
    `)
  })

  it('records Enter at every caret position', async () => {
    expect(await run('focus', ADJACENT_MARKDOWN, '{Enter}')).toMatchInlineSnapshot(`
      """
      ===== pos: 1 ===============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo]][[bar]]

      ----- selection before -----
      ┃[[foo]][[bar]]
      ----- selection after ------

      ┃[[foo]][[bar]]
      ----------------------------

      ===== pos: 2 ===============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [

      [foo]][[bar]]

      ----- selection before -----
      [┃[foo]][[bar]]
      ----- selection after ------
      [
      ┃[foo]][[bar]]
      ----------------------------

      ===== pos: 3 ===============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[

      foo]][[bar]]

      ----- selection before -----
      [[┃foo]][[bar]]
      ----- selection after ------
      [[
      ┃foo]][[bar]]
      ----------------------------

      ===== pos: 4 ===============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[f

      oo]][[bar]]

      ----- selection before -----
      [[f┃oo]][[bar]]
      ----- selection after ------
      [[f
      ┃oo]][[bar]]
      ----------------------------

      ===== pos: 5 ===============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[fo

      o]][[bar]]

      ----- selection before -----
      [[fo┃o]][[bar]]
      ----- selection after ------
      [[fo
      ┃o]][[bar]]
      ----------------------------

      ===== pos: 6 ===============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo

      ]][[bar]]

      ----- selection before -----
      [[foo┃]][[bar]]
      ----- selection after ------
      [[foo
      ┃]][[bar]]
      ----------------------------

      ===== pos: 7 ===============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo]

      ][[bar]]

      ----- selection before -----
      [[foo]┃][[bar]]
      ----- selection after ------
      [[foo]
      ┃][[bar]]
      ----------------------------

      ===== pos: 8 ===============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo]]

      [[bar]]

      ----- selection before -----
      [[foo]]┃[[bar]]
      ----- selection after ------
      [[foo]]
      ┃[[bar]]
      ----------------------------

      ===== pos: 9 ===============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo]][

      [bar]]

      ----- selection before -----
      [[foo]][┃[bar]]
      ----- selection after ------
      [[foo]][
      ┃[bar]]
      ----------------------------

      ===== pos: 10 ==============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo]][[

      bar]]

      ----- selection before -----
      [[foo]][[┃bar]]
      ----- selection after ------
      [[foo]][[
      ┃bar]]
      ----------------------------

      ===== pos: 11 ==============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo]][[b

      ar]]

      ----- selection before -----
      [[foo]][[b┃ar]]
      ----- selection after ------
      [[foo]][[b
      ┃ar]]
      ----------------------------

      ===== pos: 12 ==============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo]][[ba

      r]]

      ----- selection before -----
      [[foo]][[ba┃r]]
      ----- selection after ------
      [[foo]][[ba
      ┃r]]
      ----------------------------

      ===== pos: 13 ==============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo]][[bar

      ]]

      ----- selection before -----
      [[foo]][[bar┃]]
      ----- selection after ------
      [[foo]][[bar
      ┃]]
      ----------------------------

      ===== pos: 14 ==============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo]][[bar]

      ]

      ----- selection before -----
      [[foo]][[bar]┃]
      ----- selection after ------
      [[foo]][[bar]
      ┃]
      ----------------------------

      ===== pos: 15 ==============
      ----- markdown before ------
      [[foo]][[bar]]

      ----- markdown after -------
      [[foo]][[bar]]

      ----- selection before -----
      [[foo]][[bar]]┃
      ----- selection after ------
      [[foo]][[bar]]
      ┃
      ----------------------------
      """
    `)
  })
})
