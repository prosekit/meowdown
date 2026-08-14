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

    const markdownBefore = revealTrailingSpaces(docToMarkdown(fixture.doc)).replace(/\n$/, '')
    const selectionBefore = revealTrailingSpaces(getSelectionSnapshot(fixture.state))

    await userEvent.keyboard(key)

    const markdownAfter = revealTrailingSpaces(docToMarkdown(fixture.doc)).replace(/\n$/, '')
    const selectionAfter = revealTrailingSpaces(getSelectionSnapshot(fixture.state))

    cases.push(
      [
        getSplitline(`=`, `key: ${key} pos: ${pos}`),
        markdownBefore === markdownAfter
          ? [getSplitline(`-`, `markdown before/after`), markdownBefore]
          : [
              getSplitline(`-`, `markdown before`),
              markdownBefore,
              getSplitline(`-`, `markdown after`),
              markdownAfter,
            ],

        selectionBefore === selectionAfter
          ? [getSplitline('-', 'selection before/after'), selectionBefore]
          : [
              getSplitline(`-`, `selection before`),
              selectionBefore,
              getSplitline(`-`, `selection after`),
              selectionAfter,
            ],

        getSplitline(`-`),
      ]
        .flat()
        .join('\n'),
    )
  }
  return cases.join('\n\n')
}

function getSplitline(
  char: string,
  label: string = '',
  labelLength: number = 24,
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
      ===== key: {Backspace} pos: 2 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      top

      - [[foo]]
      - [[bar]]
      ----- selection before/after -----
      ┃top
      [[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 3 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - op
        - [[foo]]
        - [[bar]]
      ----- selection before -----------
      t┃op
      [[foo]]
      [[bar]]
      ----- selection after ------------
      ┃op
      [[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 4 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - tp
        - [[foo]]
        - [[bar]]
      ----- selection before -----------
      to┃p
      [[foo]]
      [[bar]]
      ----- selection after ------------
      t┃p
      [[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 5 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - to
        - [[foo]]
        - [[bar]]
      ----- selection before -----------
      top┃
      [[foo]]
      [[bar]]
      ----- selection after ------------
      to┃
      [[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 8 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top

        [[foo]]

        - [[bar]]
      ----- selection before/after -----
      top
      ┃[[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 9 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      ┃
      [[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 10 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      ┃
      [[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 11 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      ┃
      [[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 12 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      ┃
      [[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 13 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      ┃
      [[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 14 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      ┃
      [[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 15 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      ┃
      [[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 19 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top

        - [[foo]]

        [[bar]]
      ----- selection before/after -----
      top
      [[foo]]
      ┃[[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 20 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      ┃
      ----------------------------------

      ===== key: {Backspace} pos: 21 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      ┃
      ----------------------------------

      ===== key: {Backspace} pos: 22 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      ┃
      ----------------------------------

      ===== key: {Backspace} pos: 23 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      ┃
      ----------------------------------

      ===== key: {Backspace} pos: 24 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      ┃
      ----------------------------------

      ===== key: {Backspace} pos: 25 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      ┃
      ----------------------------------

      ===== key: {Backspace} pos: 26 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      ┃
      ----------------------------------
      """
    `)
  })

  it('records Space at every caret position', async () => {
    expect(await run('focus', OUTLINE_MARKDOWN, '{Space}')).toMatchInlineSnapshot(`
      """
      ===== key: {Space} pos: 2 ========
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      -  top
        - [[foo]]
        - [[bar]]
      ----- selection before -----------
      ┃top
      [[foo]]
      [[bar]]
      ----- selection after ------------
       ┃top
      [[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Space} pos: 3 ========
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - t op
        - [[foo]]
        - [[bar]]
      ----- selection before -----------
      t┃op
      [[foo]]
      [[bar]]
      ----- selection after ------------
      t ┃op
      [[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Space} pos: 4 ========
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - to p
        - [[foo]]
        - [[bar]]
      ----- selection before -----------
      to┃p
      [[foo]]
      [[bar]]
      ----- selection after ------------
      to ┃p
      [[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Space} pos: 5 ========
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top·
        - [[foo]]
        - [[bar]]
      ----- selection before -----------
      top┃
      [[foo]]
      [[bar]]
      ----- selection after ------------
      top ┃
      [[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Space} pos: 8 ========
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        -  [[foo]]
        - [[bar]]
      ----- selection before -----------
      top
      ┃[[foo]]
      [[bar]]
      ----- selection after ------------
      top
       ┃[[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Space} pos: 9 ========
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]·
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      [[foo]] ┃
      [[bar]]
      ----------------------------------

      ===== key: {Space} pos: 10 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]·
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      [[foo]] ┃
      [[bar]]
      ----------------------------------

      ===== key: {Space} pos: 11 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]·
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      [[foo]] ┃
      [[bar]]
      ----------------------------------

      ===== key: {Space} pos: 12 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]·
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      [[foo]] ┃
      [[bar]]
      ----------------------------------

      ===== key: {Space} pos: 13 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]·
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      [[foo]] ┃
      [[bar]]
      ----------------------------------

      ===== key: {Space} pos: 14 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]·
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      [[foo]] ┃
      [[bar]]
      ----------------------------------

      ===== key: {Space} pos: 15 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]·
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      [[foo]] ┃
      [[bar]]
      ----------------------------------

      ===== key: {Space} pos: 19 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -  [[bar]]
      ----- selection before -----------
      top
      [[foo]]
      ┃[[bar]]
      ----- selection after ------------
      top
      [[foo]]
       ┃[[bar]]
      ----------------------------------

      ===== key: {Space} pos: 20 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        - [[bar]]·
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      [[bar]] ┃
      ----------------------------------

      ===== key: {Space} pos: 21 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        - [[bar]]·
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      [[bar]] ┃
      ----------------------------------

      ===== key: {Space} pos: 22 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        - [[bar]]·
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      [[bar]] ┃
      ----------------------------------

      ===== key: {Space} pos: 23 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        - [[bar]]·
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      [[bar]] ┃
      ----------------------------------

      ===== key: {Space} pos: 24 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        - [[bar]]·
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      [[bar]] ┃
      ----------------------------------

      ===== key: {Space} pos: 25 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        - [[bar]]·
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      [[bar]] ┃
      ----------------------------------

      ===== key: {Space} pos: 26 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        - [[bar]]·
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      [[bar]] ┃
      ----------------------------------
      """
    `)
  })

  it('records Enter at every caret position', async () => {
    expect(await run('focus', OUTLINE_MARKDOWN, '{Enter}')).toMatchInlineSnapshot(`
      """
      ===== key: {Enter} pos: 2 ========
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      -
      - top
        - [[foo]]
        - [[bar]]
      ----- selection before -----------
      ┃top
      [[foo]]
      [[bar]]
      ----- selection after ------------

      ┃top
      [[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 3 ========
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - t
      - op
        - [[foo]]
        - [[bar]]
      ----- selection before -----------
      t┃op
      [[foo]]
      [[bar]]
      ----- selection after ------------
      t
      ┃op
      [[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 4 ========
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - to
      - p
        - [[foo]]
        - [[bar]]
      ----- selection before -----------
      to┃p
      [[foo]]
      [[bar]]
      ----- selection after ------------
      to
      ┃p
      [[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 5 ========
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
      -
        - [[foo]]
        - [[bar]]
      ----- selection before -----------
      top┃
      [[foo]]
      [[bar]]
      ----- selection after ------------
      top
      ┃
      [[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 8 ========
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        -
        - [[foo]]
        - [[bar]]
      ----- selection before -----------
      top
      ┃[[foo]]
      [[bar]]
      ----- selection after ------------
      top

      ┃[[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 9 ========
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      [[foo]]
      ┃
      [[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 10 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      [[foo]]
      ┃
      [[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 11 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      [[foo]]
      ┃
      [[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 12 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      [[foo]]
      ┃
      [[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 13 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      [[foo]]
      ┃
      [[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 14 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      [[foo]]
      ┃
      [[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 15 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      [[foo]]
      ┃
      [[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 19 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]
      ┃[[bar]]
      ----- selection after ------------
      top
      [[foo]]

      ┃[[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 20 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        - [[bar]]
        -
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      [[bar]]
      ┃
      ----------------------------------

      ===== key: {Enter} pos: 21 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        - [[bar]]
        -
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      [[bar]]
      ┃
      ----------------------------------

      ===== key: {Enter} pos: 22 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        - [[bar]]
        -
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      [[bar]]
      ┃
      ----------------------------------

      ===== key: {Enter} pos: 23 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        - [[bar]]
        -
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      [[bar]]
      ┃
      ----------------------------------

      ===== key: {Enter} pos: 24 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        - [[bar]]
        -
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      [[bar]]
      ┃
      ----------------------------------

      ===== key: {Enter} pos: 25 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        - [[bar]]
        -
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      [[bar]]
      ┃
      ----------------------------------

      ===== key: {Enter} pos: 26 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        - [[bar]]
        -
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      [[bar]]
      ┃
      ----------------------------------
      """
    `)
  })
})

describe('caret fuzz over a wikilink outline in hide mode', () => {
  it('records Backspace at every caret position', async () => {
    expect(await run('hide', OUTLINE_MARKDOWN, '{Backspace}')).toMatchInlineSnapshot(`
      """
      ===== key: {Backspace} pos: 2 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      top

      - [[foo]]
      - [[bar]]
      ----- selection before/after -----
      ┃top
      [[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 3 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - op
        - [[foo]]
        - [[bar]]
      ----- selection before -----------
      t┃op
      [[foo]]
      [[bar]]
      ----- selection after ------------
      ┃op
      [[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 4 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - tp
        - [[foo]]
        - [[bar]]
      ----- selection before -----------
      to┃p
      [[foo]]
      [[bar]]
      ----- selection after ------------
      t┃p
      [[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 5 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - to
        - [[foo]]
        - [[bar]]
      ----- selection before -----------
      top┃
      [[foo]]
      [[bar]]
      ----- selection after ------------
      to┃
      [[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 8 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top

        [[foo]]

        - [[bar]]
      ----- selection before/after -----
      top
      ┃[[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 9 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      ┃
      [[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 10 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      ┃
      [[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 11 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      ┃
      [[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 12 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      ┃
      [[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 13 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      ┃
      [[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 14 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      ┃
      [[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 15 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      ┃
      [[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 19 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top

        - [[foo]]

        [[bar]]
      ----- selection before/after -----
      top
      [[foo]]
      ┃[[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 20 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      ┃
      ----------------------------------

      ===== key: {Backspace} pos: 21 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      ┃
      ----------------------------------

      ===== key: {Backspace} pos: 22 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      ┃
      ----------------------------------

      ===== key: {Backspace} pos: 23 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      ┃
      ----------------------------------

      ===== key: {Backspace} pos: 24 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      ┃
      ----------------------------------

      ===== key: {Backspace} pos: 25 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      ┃
      ----------------------------------

      ===== key: {Backspace} pos: 26 =====
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      ┃
      ----------------------------------
      """
    `)
  })

  it('records Space at every caret position', async () => {
    expect(await run('hide', OUTLINE_MARKDOWN, '{Space}')).toMatchInlineSnapshot(`
      """
      ===== key: {Space} pos: 2 ========
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      -  top
        - [[foo]]
        - [[bar]]
      ----- selection before -----------
      ┃top
      [[foo]]
      [[bar]]
      ----- selection after ------------
       ┃top
      [[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Space} pos: 3 ========
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - t op
        - [[foo]]
        - [[bar]]
      ----- selection before -----------
      t┃op
      [[foo]]
      [[bar]]
      ----- selection after ------------
      t ┃op
      [[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Space} pos: 4 ========
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - to p
        - [[foo]]
        - [[bar]]
      ----- selection before -----------
      to┃p
      [[foo]]
      [[bar]]
      ----- selection after ------------
      to ┃p
      [[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Space} pos: 5 ========
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top·
        - [[foo]]
        - [[bar]]
      ----- selection before -----------
      top┃
      [[foo]]
      [[bar]]
      ----- selection after ------------
      top ┃
      [[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Space} pos: 8 ========
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        -  [[foo]]
        - [[bar]]
      ----- selection before -----------
      top
      ┃[[foo]]
      [[bar]]
      ----- selection after ------------
      top
       ┃[[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Space} pos: 9 ========
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]·
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      [[foo]] ┃
      [[bar]]
      ----------------------------------

      ===== key: {Space} pos: 10 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]·
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      [[foo]] ┃
      [[bar]]
      ----------------------------------

      ===== key: {Space} pos: 11 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]·
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      [[foo]] ┃
      [[bar]]
      ----------------------------------

      ===== key: {Space} pos: 12 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]·
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      [[foo]] ┃
      [[bar]]
      ----------------------------------

      ===== key: {Space} pos: 13 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]·
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      [[foo]] ┃
      [[bar]]
      ----------------------------------

      ===== key: {Space} pos: 14 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]·
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      [[foo]] ┃
      [[bar]]
      ----------------------------------

      ===== key: {Space} pos: 15 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]·
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      [[foo]] ┃
      [[bar]]
      ----------------------------------

      ===== key: {Space} pos: 19 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -  [[bar]]
      ----- selection before -----------
      top
      [[foo]]
      ┃[[bar]]
      ----- selection after ------------
      top
      [[foo]]
       ┃[[bar]]
      ----------------------------------

      ===== key: {Space} pos: 20 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        - [[bar]]·
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      [[bar]] ┃
      ----------------------------------

      ===== key: {Space} pos: 21 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        - [[bar]]·
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      [[bar]] ┃
      ----------------------------------

      ===== key: {Space} pos: 22 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        - [[bar]]·
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      [[bar]] ┃
      ----------------------------------

      ===== key: {Space} pos: 23 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        - [[bar]]·
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      [[bar]] ┃
      ----------------------------------

      ===== key: {Space} pos: 24 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        - [[bar]]·
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      [[bar]] ┃
      ----------------------------------

      ===== key: {Space} pos: 25 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        - [[bar]]·
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      [[bar]] ┃
      ----------------------------------

      ===== key: {Space} pos: 26 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        - [[bar]]·
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      [[bar]] ┃
      ----------------------------------
      """
    `)
  })

  it('records Enter at every caret position', async () => {
    expect(await run('hide', OUTLINE_MARKDOWN, '{Enter}')).toMatchInlineSnapshot(`
      """
      ===== key: {Enter} pos: 2 ========
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      -
      - top
        - [[foo]]
        - [[bar]]
      ----- selection before -----------
      ┃top
      [[foo]]
      [[bar]]
      ----- selection after ------------

      ┃top
      [[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 3 ========
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - t
      - op
        - [[foo]]
        - [[bar]]
      ----- selection before -----------
      t┃op
      [[foo]]
      [[bar]]
      ----- selection after ------------
      t
      ┃op
      [[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 4 ========
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - to
      - p
        - [[foo]]
        - [[bar]]
      ----- selection before -----------
      to┃p
      [[foo]]
      [[bar]]
      ----- selection after ------------
      to
      ┃p
      [[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 5 ========
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
      -
        - [[foo]]
        - [[bar]]
      ----- selection before -----------
      top┃
      [[foo]]
      [[bar]]
      ----- selection after ------------
      top
      ┃
      [[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 8 ========
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        -
        - [[foo]]
        - [[bar]]
      ----- selection before -----------
      top
      ┃[[foo]]
      [[bar]]
      ----- selection after ------------
      top

      ┃[[foo]]
      [[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 9 ========
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      [[foo]]
      ┃
      [[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 10 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      [[foo]]
      ┃
      [[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 11 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      [[foo]]
      ┃
      [[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 12 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      [[foo]]
      ┃
      [[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 13 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      [[foo]]
      ┃
      [[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 14 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      [[foo]]
      ┃
      [[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 15 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]┃
      [[bar]]
      ----- selection after ------------
      top
      [[foo]]
      ┃
      [[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 19 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        -
        - [[bar]]
      ----- selection before -----------
      top
      [[foo]]
      ┃[[bar]]
      ----- selection after ------------
      top
      [[foo]]

      ┃[[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 20 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        - [[bar]]
        -
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      [[bar]]
      ┃
      ----------------------------------

      ===== key: {Enter} pos: 21 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        - [[bar]]
        -
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      [[bar]]
      ┃
      ----------------------------------

      ===== key: {Enter} pos: 22 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        - [[bar]]
        -
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      [[bar]]
      ┃
      ----------------------------------

      ===== key: {Enter} pos: 23 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        - [[bar]]
        -
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      [[bar]]
      ┃
      ----------------------------------

      ===== key: {Enter} pos: 24 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        - [[bar]]
        -
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      [[bar]]
      ┃
      ----------------------------------

      ===== key: {Enter} pos: 25 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        - [[bar]]
        -
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      [[bar]]
      ┃
      ----------------------------------

      ===== key: {Enter} pos: 26 =======
      ----- markdown before ------------
      - top
        - [[foo]]
        - [[bar]]
      ----- markdown after -------------
      - top
        - [[foo]]
        - [[bar]]
        -
      ----- selection before -----------
      top
      [[foo]]
      [[bar]]┃
      ----- selection after ------------
      top
      [[foo]]
      [[bar]]
      ┃
      ----------------------------------
      """
    `)
  })
})

describe('caret fuzz over a wikilink inside a paragraph in focus mode', () => {
  it('records Backspace at every caret position', async () => {
    expect(await run('focus', INLINE_MARKDOWN, '{Backspace}')).toMatchInlineSnapshot(`
      """
      ===== key: {Backspace} pos: 1 =====
      ----- markdown before/after ------
      a [[foo]] b
      ----- selection before/after -----
      ┃a [[foo]] b
      ----------------------------------

      ===== key: {Backspace} pos: 2 =====
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
       [[foo]] b
      ----- selection before -----------
      a┃ [[foo]] b
      ----- selection after ------------
      ┃ [[foo]] b
      ----------------------------------

      ===== key: {Backspace} pos: 3 =====
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a[[foo]] b
      ----- selection before -----------
      a ┃[[foo]] b
      ----- selection after ------------
      a┃[[foo]] b
      ----------------------------------

      ===== key: {Backspace} pos: 4 =====
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a  b
      ----- selection before -----------
      a [[foo]]┃ b
      ----- selection after ------------
      a ┃ b
      ----------------------------------

      ===== key: {Backspace} pos: 5 =====
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a  b
      ----- selection before -----------
      a [[foo]]┃ b
      ----- selection after ------------
      a ┃ b
      ----------------------------------

      ===== key: {Backspace} pos: 6 =====
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a  b
      ----- selection before -----------
      a [[foo]]┃ b
      ----- selection after ------------
      a ┃ b
      ----------------------------------

      ===== key: {Backspace} pos: 7 =====
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a  b
      ----- selection before -----------
      a [[foo]]┃ b
      ----- selection after ------------
      a ┃ b
      ----------------------------------

      ===== key: {Backspace} pos: 8 =====
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a  b
      ----- selection before -----------
      a [[foo]]┃ b
      ----- selection after ------------
      a ┃ b
      ----------------------------------

      ===== key: {Backspace} pos: 9 =====
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a  b
      ----- selection before -----------
      a [[foo]]┃ b
      ----- selection after ------------
      a ┃ b
      ----------------------------------

      ===== key: {Backspace} pos: 10 =====
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a  b
      ----- selection before -----------
      a [[foo]]┃ b
      ----- selection after ------------
      a ┃ b
      ----------------------------------

      ===== key: {Backspace} pos: 11 =====
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a [[foo]]b
      ----- selection before -----------
      a [[foo]] ┃b
      ----- selection after ------------
      a [[foo]]┃b
      ----------------------------------

      ===== key: {Backspace} pos: 12 =====
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a [[foo]]·
      ----- selection before -----------
      a [[foo]] b┃
      ----- selection after ------------
      a [[foo]] ┃
      ----------------------------------
      """
    `)
  })

  it('records Space at every caret position', async () => {
    expect(await run('focus', INLINE_MARKDOWN, '{Space}')).toMatchInlineSnapshot(`
      """
      ===== key: {Space} pos: 1 ========
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
       a [[foo]] b
      ----- selection before -----------
      ┃a [[foo]] b
      ----- selection after ------------
       ┃a [[foo]] b
      ----------------------------------

      ===== key: {Space} pos: 2 ========
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a  [[foo]] b
      ----- selection before -----------
      a┃ [[foo]] b
      ----- selection after ------------
      a ┃ [[foo]] b
      ----------------------------------

      ===== key: {Space} pos: 3 ========
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a  [[foo]] b
      ----- selection before -----------
      a ┃[[foo]] b
      ----- selection after ------------
      a  ┃[[foo]] b
      ----------------------------------

      ===== key: {Space} pos: 4 ========
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a [[foo]]  b
      ----- selection before -----------
      a [[foo]]┃ b
      ----- selection after ------------
      a [[foo]] ┃ b
      ----------------------------------

      ===== key: {Space} pos: 5 ========
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a [[foo]]  b
      ----- selection before -----------
      a [[foo]]┃ b
      ----- selection after ------------
      a [[foo]] ┃ b
      ----------------------------------

      ===== key: {Space} pos: 6 ========
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a [[foo]]  b
      ----- selection before -----------
      a [[foo]]┃ b
      ----- selection after ------------
      a [[foo]] ┃ b
      ----------------------------------

      ===== key: {Space} pos: 7 ========
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a [[foo]]  b
      ----- selection before -----------
      a [[foo]]┃ b
      ----- selection after ------------
      a [[foo]] ┃ b
      ----------------------------------

      ===== key: {Space} pos: 8 ========
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a [[foo]]  b
      ----- selection before -----------
      a [[foo]]┃ b
      ----- selection after ------------
      a [[foo]] ┃ b
      ----------------------------------

      ===== key: {Space} pos: 9 ========
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a [[foo]]  b
      ----- selection before -----------
      a [[foo]]┃ b
      ----- selection after ------------
      a [[foo]] ┃ b
      ----------------------------------

      ===== key: {Space} pos: 10 =======
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a [[foo]]  b
      ----- selection before -----------
      a [[foo]]┃ b
      ----- selection after ------------
      a [[foo]] ┃ b
      ----------------------------------

      ===== key: {Space} pos: 11 =======
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a [[foo]]  b
      ----- selection before -----------
      a [[foo]] ┃b
      ----- selection after ------------
      a [[foo]]  ┃b
      ----------------------------------

      ===== key: {Space} pos: 12 =======
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a [[foo]] b·
      ----- selection before -----------
      a [[foo]] b┃
      ----- selection after ------------
      a [[foo]] b ┃
      ----------------------------------
      """
    `)
  })

  it('records Enter at every caret position', async () => {
    expect(await run('focus', INLINE_MARKDOWN, '{Enter}')).toMatchInlineSnapshot(`
      """
      ===== key: {Enter} pos: 1 ========
      ----- markdown before/after ------
      a [[foo]] b
      ----- selection before -----------
      ┃a [[foo]] b
      ----- selection after ------------

      ┃a [[foo]] b
      ----------------------------------

      ===== key: {Enter} pos: 2 ========
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a

       [[foo]] b
      ----- selection before -----------
      a┃ [[foo]] b
      ----- selection after ------------
      a
      ┃ [[foo]] b
      ----------------------------------

      ===== key: {Enter} pos: 3 ========
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a·

      [[foo]] b
      ----- selection before -----------
      a ┃[[foo]] b
      ----- selection after ------------
      a·
      ┃[[foo]] b
      ----------------------------------

      ===== key: {Enter} pos: 4 ========
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a [[foo]]

       b
      ----- selection before -----------
      a [[foo]]┃ b
      ----- selection after ------------
      a [[foo]]
      ┃ b
      ----------------------------------

      ===== key: {Enter} pos: 5 ========
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a [[foo]]

       b
      ----- selection before -----------
      a [[foo]]┃ b
      ----- selection after ------------
      a [[foo]]
      ┃ b
      ----------------------------------

      ===== key: {Enter} pos: 6 ========
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a [[foo]]

       b
      ----- selection before -----------
      a [[foo]]┃ b
      ----- selection after ------------
      a [[foo]]
      ┃ b
      ----------------------------------

      ===== key: {Enter} pos: 7 ========
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a [[foo]]

       b
      ----- selection before -----------
      a [[foo]]┃ b
      ----- selection after ------------
      a [[foo]]
      ┃ b
      ----------------------------------

      ===== key: {Enter} pos: 8 ========
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a [[foo]]

       b
      ----- selection before -----------
      a [[foo]]┃ b
      ----- selection after ------------
      a [[foo]]
      ┃ b
      ----------------------------------

      ===== key: {Enter} pos: 9 ========
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a [[foo]]

       b
      ----- selection before -----------
      a [[foo]]┃ b
      ----- selection after ------------
      a [[foo]]
      ┃ b
      ----------------------------------

      ===== key: {Enter} pos: 10 =======
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a [[foo]]

       b
      ----- selection before -----------
      a [[foo]]┃ b
      ----- selection after ------------
      a [[foo]]
      ┃ b
      ----------------------------------

      ===== key: {Enter} pos: 11 =======
      ----- markdown before ------------
      a [[foo]] b
      ----- markdown after -------------
      a [[foo]]·

      b
      ----- selection before -----------
      a [[foo]] ┃b
      ----- selection after ------------
      a [[foo]]·
      ┃b
      ----------------------------------

      ===== key: {Enter} pos: 12 =======
      ----- markdown before/after ------
      a [[foo]] b
      ----- selection before -----------
      a [[foo]] b┃
      ----- selection after ------------
      a [[foo]] b
      ┃
      ----------------------------------
      """
    `)
  })
})

describe('caret fuzz over two adjacent wikilinks in focus mode', () => {
  it('records Backspace at every caret position', async () => {
    expect(await run('focus', ADJACENT_MARKDOWN, '{Backspace}')).toMatchInlineSnapshot(`
      """
      ===== key: {Backspace} pos: 1 =====
      ----- markdown before/after ------
      [[foo]][[bar]]
      ----- selection before/after -----
      ┃[[foo]][[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 2 =====
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[bar]]
      ----- selection before -----------
      [[foo]]┃[[bar]]
      ----- selection after ------------
      ┃[[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 3 =====
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[bar]]
      ----- selection before -----------
      [[foo]]┃[[bar]]
      ----- selection after ------------
      ┃[[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 4 =====
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[bar]]
      ----- selection before -----------
      [[foo]]┃[[bar]]
      ----- selection after ------------
      ┃[[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 5 =====
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[bar]]
      ----- selection before -----------
      [[foo]]┃[[bar]]
      ----- selection after ------------
      ┃[[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 6 =====
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[bar]]
      ----- selection before -----------
      [[foo]]┃[[bar]]
      ----- selection after ------------
      ┃[[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 7 =====
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[bar]]
      ----- selection before -----------
      [[foo]]┃[[bar]]
      ----- selection after ------------
      ┃[[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 8 =====
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[bar]]
      ----- selection before -----------
      [[foo]]┃[[bar]]
      ----- selection after ------------
      ┃[[bar]]
      ----------------------------------

      ===== key: {Backspace} pos: 9 =====
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[foo]]
      ----- selection before -----------
      [[foo]][[bar]]┃
      ----- selection after ------------
      [[foo]]┃
      ----------------------------------

      ===== key: {Backspace} pos: 10 =====
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[foo]]
      ----- selection before -----------
      [[foo]][[bar]]┃
      ----- selection after ------------
      [[foo]]┃
      ----------------------------------

      ===== key: {Backspace} pos: 11 =====
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[foo]]
      ----- selection before -----------
      [[foo]][[bar]]┃
      ----- selection after ------------
      [[foo]]┃
      ----------------------------------

      ===== key: {Backspace} pos: 12 =====
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[foo]]
      ----- selection before -----------
      [[foo]][[bar]]┃
      ----- selection after ------------
      [[foo]]┃
      ----------------------------------

      ===== key: {Backspace} pos: 13 =====
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[foo]]
      ----- selection before -----------
      [[foo]][[bar]]┃
      ----- selection after ------------
      [[foo]]┃
      ----------------------------------

      ===== key: {Backspace} pos: 14 =====
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[foo]]
      ----- selection before -----------
      [[foo]][[bar]]┃
      ----- selection after ------------
      [[foo]]┃
      ----------------------------------

      ===== key: {Backspace} pos: 15 =====
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[foo]]
      ----- selection before -----------
      [[foo]][[bar]]┃
      ----- selection after ------------
      [[foo]]┃
      ----------------------------------
      """
    `)
  })

  it('records Space at every caret position', async () => {
    expect(await run('focus', ADJACENT_MARKDOWN, '{Space}')).toMatchInlineSnapshot(`
      """
      ===== key: {Space} pos: 1 ========
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
       [[foo]][[bar]]
      ----- selection before -----------
      ┃[[foo]][[bar]]
      ----- selection after ------------
       ┃[[foo]][[bar]]
      ----------------------------------

      ===== key: {Space} pos: 2 ========
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[foo]] [[bar]]
      ----- selection before -----------
      [[foo]]┃[[bar]]
      ----- selection after ------------
      [[foo]] ┃[[bar]]
      ----------------------------------

      ===== key: {Space} pos: 3 ========
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[foo]] [[bar]]
      ----- selection before -----------
      [[foo]]┃[[bar]]
      ----- selection after ------------
      [[foo]] ┃[[bar]]
      ----------------------------------

      ===== key: {Space} pos: 4 ========
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[foo]] [[bar]]
      ----- selection before -----------
      [[foo]]┃[[bar]]
      ----- selection after ------------
      [[foo]] ┃[[bar]]
      ----------------------------------

      ===== key: {Space} pos: 5 ========
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[foo]] [[bar]]
      ----- selection before -----------
      [[foo]]┃[[bar]]
      ----- selection after ------------
      [[foo]] ┃[[bar]]
      ----------------------------------

      ===== key: {Space} pos: 6 ========
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[foo]] [[bar]]
      ----- selection before -----------
      [[foo]]┃[[bar]]
      ----- selection after ------------
      [[foo]] ┃[[bar]]
      ----------------------------------

      ===== key: {Space} pos: 7 ========
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[foo]] [[bar]]
      ----- selection before -----------
      [[foo]]┃[[bar]]
      ----- selection after ------------
      [[foo]] ┃[[bar]]
      ----------------------------------

      ===== key: {Space} pos: 8 ========
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[foo]] [[bar]]
      ----- selection before -----------
      [[foo]]┃[[bar]]
      ----- selection after ------------
      [[foo]] ┃[[bar]]
      ----------------------------------

      ===== key: {Space} pos: 9 ========
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[foo]][[bar]]·
      ----- selection before -----------
      [[foo]][[bar]]┃
      ----- selection after ------------
      [[foo]][[bar]] ┃
      ----------------------------------

      ===== key: {Space} pos: 10 =======
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[foo]][[bar]]·
      ----- selection before -----------
      [[foo]][[bar]]┃
      ----- selection after ------------
      [[foo]][[bar]] ┃
      ----------------------------------

      ===== key: {Space} pos: 11 =======
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[foo]][[bar]]·
      ----- selection before -----------
      [[foo]][[bar]]┃
      ----- selection after ------------
      [[foo]][[bar]] ┃
      ----------------------------------

      ===== key: {Space} pos: 12 =======
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[foo]][[bar]]·
      ----- selection before -----------
      [[foo]][[bar]]┃
      ----- selection after ------------
      [[foo]][[bar]] ┃
      ----------------------------------

      ===== key: {Space} pos: 13 =======
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[foo]][[bar]]·
      ----- selection before -----------
      [[foo]][[bar]]┃
      ----- selection after ------------
      [[foo]][[bar]] ┃
      ----------------------------------

      ===== key: {Space} pos: 14 =======
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[foo]][[bar]]·
      ----- selection before -----------
      [[foo]][[bar]]┃
      ----- selection after ------------
      [[foo]][[bar]] ┃
      ----------------------------------

      ===== key: {Space} pos: 15 =======
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[foo]][[bar]]·
      ----- selection before -----------
      [[foo]][[bar]]┃
      ----- selection after ------------
      [[foo]][[bar]] ┃
      ----------------------------------
      """
    `)
  })

  it('records Enter at every caret position', async () => {
    expect(await run('focus', ADJACENT_MARKDOWN, '{Enter}')).toMatchInlineSnapshot(`
      """
      ===== key: {Enter} pos: 1 ========
      ----- markdown before/after ------
      [[foo]][[bar]]
      ----- selection before -----------
      ┃[[foo]][[bar]]
      ----- selection after ------------

      ┃[[foo]][[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 2 ========
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[foo]]

      [[bar]]
      ----- selection before -----------
      [[foo]]┃[[bar]]
      ----- selection after ------------
      [[foo]]
      ┃[[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 3 ========
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[foo]]

      [[bar]]
      ----- selection before -----------
      [[foo]]┃[[bar]]
      ----- selection after ------------
      [[foo]]
      ┃[[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 4 ========
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[foo]]

      [[bar]]
      ----- selection before -----------
      [[foo]]┃[[bar]]
      ----- selection after ------------
      [[foo]]
      ┃[[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 5 ========
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[foo]]

      [[bar]]
      ----- selection before -----------
      [[foo]]┃[[bar]]
      ----- selection after ------------
      [[foo]]
      ┃[[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 6 ========
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[foo]]

      [[bar]]
      ----- selection before -----------
      [[foo]]┃[[bar]]
      ----- selection after ------------
      [[foo]]
      ┃[[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 7 ========
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[foo]]

      [[bar]]
      ----- selection before -----------
      [[foo]]┃[[bar]]
      ----- selection after ------------
      [[foo]]
      ┃[[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 8 ========
      ----- markdown before ------------
      [[foo]][[bar]]
      ----- markdown after -------------
      [[foo]]

      [[bar]]
      ----- selection before -----------
      [[foo]]┃[[bar]]
      ----- selection after ------------
      [[foo]]
      ┃[[bar]]
      ----------------------------------

      ===== key: {Enter} pos: 9 ========
      ----- markdown before/after ------
      [[foo]][[bar]]
      ----- selection before -----------
      [[foo]][[bar]]┃
      ----- selection after ------------
      [[foo]][[bar]]
      ┃
      ----------------------------------

      ===== key: {Enter} pos: 10 =======
      ----- markdown before/after ------
      [[foo]][[bar]]
      ----- selection before -----------
      [[foo]][[bar]]┃
      ----- selection after ------------
      [[foo]][[bar]]
      ┃
      ----------------------------------

      ===== key: {Enter} pos: 11 =======
      ----- markdown before/after ------
      [[foo]][[bar]]
      ----- selection before -----------
      [[foo]][[bar]]┃
      ----- selection after ------------
      [[foo]][[bar]]
      ┃
      ----------------------------------

      ===== key: {Enter} pos: 12 =======
      ----- markdown before/after ------
      [[foo]][[bar]]
      ----- selection before -----------
      [[foo]][[bar]]┃
      ----- selection after ------------
      [[foo]][[bar]]
      ┃
      ----------------------------------

      ===== key: {Enter} pos: 13 =======
      ----- markdown before/after ------
      [[foo]][[bar]]
      ----- selection before -----------
      [[foo]][[bar]]┃
      ----- selection after ------------
      [[foo]][[bar]]
      ┃
      ----------------------------------

      ===== key: {Enter} pos: 14 =======
      ----- markdown before/after ------
      [[foo]][[bar]]
      ----- selection before -----------
      [[foo]][[bar]]┃
      ----- selection after ------------
      [[foo]][[bar]]
      ┃
      ----------------------------------

      ===== key: {Enter} pos: 15 =======
      ----- markdown before/after ------
      [[foo]][[bar]]
      ----- selection before -----------
      [[foo]][[bar]]┃
      ----- selection after ------------
      [[foo]][[bar]]
      ┃
      ----------------------------------
      """
    `)
  })
})
