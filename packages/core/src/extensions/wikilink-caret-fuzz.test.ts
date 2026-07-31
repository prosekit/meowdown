import type { EditorNode } from '@prosekit/pm/model'
import { Selection, TextSelection } from '@prosekit/pm/state'
import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { markdownToDoc } from '../converters/md-to-pm.ts'
import { docToMarkdown } from '../converters/pm-to-md.ts'
import { getSelectionSnapshot, setupFixture } from '../testing/index.ts'

import type { MarkMode } from './mark-mode.ts'

const pmRoot = page.locate('.ProseMirror')

const FUZZ_TIMEOUT = 300_000

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

// Continuation lines line up under the first one, so a multi-block document
// reads as a block instead of a run-on line. A space typed at the end of a
// block is content, so trailing spaces are drawn as `·` rather than left to
// vanish into the snapshot.
function renderLabelled(label: string, text: string): string {
  const gutter = `  ${label.padEnd(6)}  `
  const indent = ' '.repeat(gutter.length)
  return text
    .split('\n')
    .map((line) => line.replace(/ +$/, (spaces) => '·'.repeat(spaces.length)))
    .map((line, index) => `${index === 0 ? gutter : indent}${line}`.trimEnd())
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

    const before = getSelectionSnapshot(fixture.state)
    await userEvent.keyboard(key)

    cases.push(
      [
        `pos ${pos}`,
        renderLabelled('before', before),
        renderLabelled('after', getSelectionSnapshot(fixture.state)),
        renderLabelled('md', docToMarkdown(fixture.doc).replace(/\n+$/, '')),
      ].join('\n'),
    )
  }
  return cases.join('\n\n')
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
          pos 2
            before  ┃top
                    [[foo]]
                    [[bar]]
            after   ┃top
                    [[foo]]
                    [[bar]]
            md      top

                    - [[foo]]
                    - [[bar]]

          pos 3
            before  t┃op
                    [[foo]]
                    [[bar]]
            after   ┃op
                    [[foo]]
                    [[bar]]
            md      - op
                      - [[foo]]
                      - [[bar]]

          pos 4
            before  to┃p
                    [[foo]]
                    [[bar]]
            after   t┃p
                    [[foo]]
                    [[bar]]
            md      - tp
                      - [[foo]]
                      - [[bar]]

          pos 5
            before  top┃
                    [[foo]]
                    [[bar]]
            after   to┃
                    [[foo]]
                    [[bar]]
            md      - to
                      - [[foo]]
                      - [[bar]]

          pos 8
            before  top
                    ┃[[foo]]
                    [[bar]]
            after   top
                    ┃[[foo]]
                    [[bar]]
            md      - top

                      [[foo]]

                      - [[bar]]

          pos 9
            before  top
                    [┃[foo]]
                    [[bar]]
            after   top
                    ┃[foo]]
                    [[bar]]
            md      - top
                      - [foo]]
                      - [[bar]]

          pos 10
            before  top
                    [[┃foo]]
                    [[bar]]
            after   top
                    [┃foo]]
                    [[bar]]
            md      - top
                      - [foo]]
                      - [[bar]]

          pos 11
            before  top
                    [[f┃oo]]
                    [[bar]]
            after   top
                    [[┃oo]]
                    [[bar]]
            md      - top
                      - [[oo]]
                      - [[bar]]

          pos 12
            before  top
                    [[fo┃o]]
                    [[bar]]
            after   top
                    [[f┃o]]
                    [[bar]]
            md      - top
                      - [[fo]]
                      - [[bar]]

          pos 13
            before  top
                    [[foo┃]]
                    [[bar]]
            after   top
                    [[fo┃]]
                    [[bar]]
            md      - top
                      - [[fo]]
                      - [[bar]]

          pos 14
            before  top
                    [[foo]┃]
                    [[bar]]
            after   top
                    [[foo┃]
                    [[bar]]
            md      - top
                      - [[foo]
                      - [[bar]]

          pos 15
            before  top
                    [[foo]]┃
                    [[bar]]
            after   top
                    ┃
                    [[bar]]
            md      - top
                      -
                      - [[bar]]

          pos 19
            before  top
                    [[foo]]
                    ┃[[bar]]
            after   top
                    [[foo]]
                    ┃[[bar]]
            md      - top

                      - [[foo]]

                      [[bar]]

          pos 20
            before  top
                    [[foo]]
                    [┃[bar]]
            after   top
                    [[foo]]
                    ┃[bar]]
            md      - top
                      - [[foo]]
                      - [bar]]

          pos 21
            before  top
                    [[foo]]
                    [[┃bar]]
            after   top
                    [[foo]]
                    [┃bar]]
            md      - top
                      - [[foo]]
                      - [bar]]

          pos 22
            before  top
                    [[foo]]
                    [[b┃ar]]
            after   top
                    [[foo]]
                    [[┃ar]]
            md      - top
                      - [[foo]]
                      - [[ar]]

          pos 23
            before  top
                    [[foo]]
                    [[ba┃r]]
            after   top
                    [[foo]]
                    [[b┃r]]
            md      - top
                      - [[foo]]
                      - [[br]]

          pos 24
            before  top
                    [[foo]]
                    [[bar┃]]
            after   top
                    [[foo]]
                    [[ba┃]]
            md      - top
                      - [[foo]]
                      - [[ba]]

          pos 25
            before  top
                    [[foo]]
                    [[bar]┃]
            after   top
                    [[foo]]
                    [[bar┃]
            md      - top
                      - [[foo]]
                      - [[bar]

          pos 26
            before  top
                    [[foo]]
                    [[bar]]┃
            after   top
                    [[foo]]
                    ┃
            md      - top
                      - [[foo]]
                      -
          """
        `)
    },
    FUZZ_TIMEOUT,
  )

  it(
    'records Space at every caret position',
    async () => {
      expect(await fuzzKey('focus', OUTLINE_MARKDOWN, ' ')).toMatchInlineSnapshot(`
        """
        pos 2
          before  ┃top
                  [[foo]]
                  [[bar]]
          after    ┃top
                  [[foo]]
                  [[bar]]
          md      -  top
                    - [[foo]]
                    - [[bar]]

        pos 3
          before  t┃op
                  [[foo]]
                  [[bar]]
          after   t ┃op
                  [[foo]]
                  [[bar]]
          md      - t op
                    - [[foo]]
                    - [[bar]]

        pos 4
          before  to┃p
                  [[foo]]
                  [[bar]]
          after   to ┃p
                  [[foo]]
                  [[bar]]
          md      - to p
                    - [[foo]]
                    - [[bar]]

        pos 5
          before  top┃
                  [[foo]]
                  [[bar]]
          after   top ┃
                  [[foo]]
                  [[bar]]
          md      - top·
                    - [[foo]]
                    - [[bar]]

        pos 8
          before  top
                  ┃[[foo]]
                  [[bar]]
          after   top
                   ┃[[foo]]
                  [[bar]]
          md      - top
                    -  [[foo]]
                    - [[bar]]

        pos 9
          before  top
                  [┃[foo]]
                  [[bar]]
          after   top
                  [ ┃[foo]]
                  [[bar]]
          md      - top
                    - [ [foo]]
                    - [[bar]]

        pos 10
          before  top
                  [[┃foo]]
                  [[bar]]
          after   top
                  [[ ┃foo]]
                  [[bar]]
          md      - top
                    - [[ foo]]
                    - [[bar]]

        pos 11
          before  top
                  [[f┃oo]]
                  [[bar]]
          after   top
                  [[f ┃oo]]
                  [[bar]]
          md      - top
                    - [[f oo]]
                    - [[bar]]

        pos 12
          before  top
                  [[fo┃o]]
                  [[bar]]
          after   top
                  [[fo ┃o]]
                  [[bar]]
          md      - top
                    - [[fo o]]
                    - [[bar]]

        pos 13
          before  top
                  [[foo┃]]
                  [[bar]]
          after   top
                  [[foo ┃]]
                  [[bar]]
          md      - top
                    - [[foo ]]
                    - [[bar]]

        pos 14
          before  top
                  [[foo]┃]
                  [[bar]]
          after   top
                  [[foo] ┃]
                  [[bar]]
          md      - top
                    - [[foo] ]
                    - [[bar]]

        pos 15
          before  top
                  [[foo]]┃
                  [[bar]]
          after   top
                  [[foo]] ┃
                  [[bar]]
          md      - top
                    - [[foo]]·
                    - [[bar]]

        pos 19
          before  top
                  [[foo]]
                  ┃[[bar]]
          after   top
                  [[foo]]
                   ┃[[bar]]
          md      - top
                    - [[foo]]
                    -  [[bar]]

        pos 20
          before  top
                  [[foo]]
                  [┃[bar]]
          after   top
                  [[foo]]
                  [ ┃[bar]]
          md      - top
                    - [[foo]]
                    - [ [bar]]

        pos 21
          before  top
                  [[foo]]
                  [[┃bar]]
          after   top
                  [[foo]]
                  [[ ┃bar]]
          md      - top
                    - [[foo]]
                    - [[ bar]]

        pos 22
          before  top
                  [[foo]]
                  [[b┃ar]]
          after   top
                  [[foo]]
                  [[b ┃ar]]
          md      - top
                    - [[foo]]
                    - [[b ar]]

        pos 23
          before  top
                  [[foo]]
                  [[ba┃r]]
          after   top
                  [[foo]]
                  [[ba ┃r]]
          md      - top
                    - [[foo]]
                    - [[ba r]]

        pos 24
          before  top
                  [[foo]]
                  [[bar┃]]
          after   top
                  [[foo]]
                  [[bar ┃]]
          md      - top
                    - [[foo]]
                    - [[bar ]]

        pos 25
          before  top
                  [[foo]]
                  [[bar]┃]
          after   top
                  [[foo]]
                  [[bar] ┃]
          md      - top
                    - [[foo]]
                    - [[bar] ]

        pos 26
          before  top
                  [[foo]]
                  [[bar]]┃
          after   top
                  [[foo]]
                  [[bar]] ┃
          md      - top
                    - [[foo]]
                    - [[bar]]
        """
      `)
    },
    FUZZ_TIMEOUT,
  )

  it(
    'records Enter at every caret position',
    async () => {
      expect(await fuzzKey('focus', OUTLINE_MARKDOWN, '{Enter}')).toMatchInlineSnapshot(`
        """
        pos 2
          before  ┃top
                  [[foo]]
                  [[bar]]
          after
                  ┃top
                  [[foo]]
                  [[bar]]
          md      -
                  - top
                    - [[foo]]
                    - [[bar]]

        pos 3
          before  t┃op
                  [[foo]]
                  [[bar]]
          after   t
                  ┃op
                  [[foo]]
                  [[bar]]
          md      - t
                  - op
                    - [[foo]]
                    - [[bar]]

        pos 4
          before  to┃p
                  [[foo]]
                  [[bar]]
          after   to
                  ┃p
                  [[foo]]
                  [[bar]]
          md      - to
                  - p
                    - [[foo]]
                    - [[bar]]

        pos 5
          before  top┃
                  [[foo]]
                  [[bar]]
          after   top
                  ┃
                  [[foo]]
                  [[bar]]
          md      - top
                  -
                    - [[foo]]
                    - [[bar]]

        pos 8
          before  top
                  ┃[[foo]]
                  [[bar]]
          after   top

                  ┃[[foo]]
                  [[bar]]
          md      - top
                    -
                    - [[foo]]
                    - [[bar]]

        pos 9
          before  top
                  [┃[foo]]
                  [[bar]]
          after   top
                  [
                  ┃[foo]]
                  [[bar]]
          md      - top
                    - [
                    - [foo]]
                    - [[bar]]

        pos 10
          before  top
                  [[┃foo]]
                  [[bar]]
          after   top
                  [[
                  ┃foo]]
                  [[bar]]
          md      - top
                    - [[
                    - foo]]
                    - [[bar]]

        pos 11
          before  top
                  [[f┃oo]]
                  [[bar]]
          after   top
                  [[f
                  ┃oo]]
                  [[bar]]
          md      - top
                    - [[f
                    - oo]]
                    - [[bar]]

        pos 12
          before  top
                  [[fo┃o]]
                  [[bar]]
          after   top
                  [[fo
                  ┃o]]
                  [[bar]]
          md      - top
                    - [[fo
                    - o]]
                    - [[bar]]

        pos 13
          before  top
                  [[foo┃]]
                  [[bar]]
          after   top
                  [[foo
                  ┃]]
                  [[bar]]
          md      - top
                    - [[foo
                    - ]]
                    - [[bar]]

        pos 14
          before  top
                  [[foo]┃]
                  [[bar]]
          after   top
                  [[foo]
                  ┃]
                  [[bar]]
          md      - top
                    - [[foo]
                    - ]
                    - [[bar]]

        pos 15
          before  top
                  [[foo]]┃
                  [[bar]]
          after   top
                  [[foo]]
                  ┃
                  [[bar]]
          md      - top
                    - [[foo]]
                    -
                    - [[bar]]

        pos 19
          before  top
                  [[foo]]
                  ┃[[bar]]
          after   top
                  [[foo]]

                  ┃[[bar]]
          md      - top
                    - [[foo]]
                    -
                    - [[bar]]

        pos 20
          before  top
                  [[foo]]
                  [┃[bar]]
          after   top
                  [[foo]]
                  [
                  ┃[bar]]
          md      - top
                    - [[foo]]
                    - [
                    - [bar]]

        pos 21
          before  top
                  [[foo]]
                  [[┃bar]]
          after   top
                  [[foo]]
                  [[
                  ┃bar]]
          md      - top
                    - [[foo]]
                    - [[
                    - bar]]

        pos 22
          before  top
                  [[foo]]
                  [[b┃ar]]
          after   top
                  [[foo]]
                  [[b
                  ┃ar]]
          md      - top
                    - [[foo]]
                    - [[b
                    - ar]]

        pos 23
          before  top
                  [[foo]]
                  [[ba┃r]]
          after   top
                  [[foo]]
                  [[ba
                  ┃r]]
          md      - top
                    - [[foo]]
                    - [[ba
                    - r]]

        pos 24
          before  top
                  [[foo]]
                  [[bar┃]]
          after   top
                  [[foo]]
                  [[bar
                  ┃]]
          md      - top
                    - [[foo]]
                    - [[bar
                    - ]]

        pos 25
          before  top
                  [[foo]]
                  [[bar]┃]
          after   top
                  [[foo]]
                  [[bar]
                  ┃]
          md      - top
                    - [[foo]]
                    - [[bar]
                    - ]

        pos 26
          before  top
                  [[foo]]
                  [[bar]]┃
          after   top
                  [[foo]]
                  [[bar]]
                  ┃
          md      - top
                    - [[foo]]
                    - [[bar]]
                    -
        """
      `)
    },
    FUZZ_TIMEOUT,
  )
})

describe('caret fuzz over a wikilink outline in hide mode', () => {
  it(
    'records Backspace at every caret position',
    async () => {
      expect(await fuzzKey('hide', OUTLINE_MARKDOWN, '{Backspace}')).toMatchInlineSnapshot(`
          """
          pos 2
            before  ┃top
                    [[foo]]
                    [[bar]]
            after   ┃top
                    [[foo]]
                    [[bar]]
            md      top

                    - [[foo]]
                    - [[bar]]

          pos 3
            before  t┃op
                    [[foo]]
                    [[bar]]
            after   ┃op
                    [[foo]]
                    [[bar]]
            md      - op
                      - [[foo]]
                      - [[bar]]

          pos 4
            before  to┃p
                    [[foo]]
                    [[bar]]
            after   t┃p
                    [[foo]]
                    [[bar]]
            md      - tp
                      - [[foo]]
                      - [[bar]]

          pos 5
            before  top┃
                    [[foo]]
                    [[bar]]
            after   to┃
                    [[foo]]
                    [[bar]]
            md      - to
                      - [[foo]]
                      - [[bar]]

          pos 8
            before  top
                    ┃[[foo]]
                    [[bar]]
            after   top
                    ┃[[foo]]
                    [[bar]]
            md      - top

                      [[foo]]

                      - [[bar]]

          pos 9
            before  top
                    [┃[foo]]
                    [[bar]]
            after   top
                    ┃[foo]]
                    [[bar]]
            md      - top
                      - [foo]]
                      - [[bar]]

          pos 10
            before  top
                    [[┃foo]]
                    [[bar]]
            after   top
                    [┃foo]]
                    [[bar]]
            md      - top
                      - [foo]]
                      - [[bar]]

          pos 11
            before  top
                    [[f┃oo]]
                    [[bar]]
            after   top
                    [[┃oo]]
                    [[bar]]
            md      - top
                      - [[oo]]
                      - [[bar]]

          pos 12
            before  top
                    [[fo┃o]]
                    [[bar]]
            after   top
                    [[f┃o]]
                    [[bar]]
            md      - top
                      - [[fo]]
                      - [[bar]]

          pos 13
            before  top
                    [[foo┃]]
                    [[bar]]
            after   top
                    [[fo┃]]
                    [[bar]]
            md      - top
                      - [[fo]]
                      - [[bar]]

          pos 14
            before  top
                    [[foo]┃]
                    [[bar]]
            after   top
                    [[foo┃]
                    [[bar]]
            md      - top
                      - [[foo]
                      - [[bar]]

          pos 15
            before  top
                    [[foo]]┃
                    [[bar]]
            after   top
                    ┃
                    [[bar]]
            md      - top
                      -
                      - [[bar]]

          pos 19
            before  top
                    [[foo]]
                    ┃[[bar]]
            after   top
                    [[foo]]
                    ┃[[bar]]
            md      - top

                      - [[foo]]

                      [[bar]]

          pos 20
            before  top
                    [[foo]]
                    [┃[bar]]
            after   top
                    [[foo]]
                    ┃[bar]]
            md      - top
                      - [[foo]]
                      - [bar]]

          pos 21
            before  top
                    [[foo]]
                    [[┃bar]]
            after   top
                    [[foo]]
                    [┃bar]]
            md      - top
                      - [[foo]]
                      - [bar]]

          pos 22
            before  top
                    [[foo]]
                    [[b┃ar]]
            after   top
                    [[foo]]
                    [[┃ar]]
            md      - top
                      - [[foo]]
                      - [[ar]]

          pos 23
            before  top
                    [[foo]]
                    [[ba┃r]]
            after   top
                    [[foo]]
                    [[b┃r]]
            md      - top
                      - [[foo]]
                      - [[br]]

          pos 24
            before  top
                    [[foo]]
                    [[bar┃]]
            after   top
                    [[foo]]
                    [[ba┃]]
            md      - top
                      - [[foo]]
                      - [[ba]]

          pos 25
            before  top
                    [[foo]]
                    [[bar]┃]
            after   top
                    [[foo]]
                    [[bar┃]
            md      - top
                      - [[foo]]
                      - [[bar]

          pos 26
            before  top
                    [[foo]]
                    [[bar]]┃
            after   top
                    [[foo]]
                    ┃
            md      - top
                      - [[foo]]
                      -
          """
        `)
    },
    FUZZ_TIMEOUT,
  )

  it(
    'records Space at every caret position',
    async () => {
      expect(await fuzzKey('hide', OUTLINE_MARKDOWN, ' ')).toMatchInlineSnapshot(`
        """
        pos 2
          before  ┃top
                  [[foo]]
                  [[bar]]
          after    ┃top
                  [[foo]]
                  [[bar]]
          md      -  top
                    - [[foo]]
                    - [[bar]]

        pos 3
          before  t┃op
                  [[foo]]
                  [[bar]]
          after   t ┃op
                  [[foo]]
                  [[bar]]
          md      - t op
                    - [[foo]]
                    - [[bar]]

        pos 4
          before  to┃p
                  [[foo]]
                  [[bar]]
          after   to ┃p
                  [[foo]]
                  [[bar]]
          md      - to p
                    - [[foo]]
                    - [[bar]]

        pos 5
          before  top┃
                  [[foo]]
                  [[bar]]
          after   top ┃
                  [[foo]]
                  [[bar]]
          md      - top·
                    - [[foo]]
                    - [[bar]]

        pos 8
          before  top
                  ┃[[foo]]
                  [[bar]]
          after   top
                   ┃[[foo]]
                  [[bar]]
          md      - top
                    -  [[foo]]
                    - [[bar]]

        pos 9
          before  top
                  [┃[foo]]
                  [[bar]]
          after   top
                  [ ┃[foo]]
                  [[bar]]
          md      - top
                    - [ [foo]]
                    - [[bar]]

        pos 10
          before  top
                  [[┃foo]]
                  [[bar]]
          after   top
                  [[ ┃foo]]
                  [[bar]]
          md      - top
                    - [[ foo]]
                    - [[bar]]

        pos 11
          before  top
                  [[f┃oo]]
                  [[bar]]
          after   top
                  [[f ┃oo]]
                  [[bar]]
          md      - top
                    - [[f oo]]
                    - [[bar]]

        pos 12
          before  top
                  [[fo┃o]]
                  [[bar]]
          after   top
                  [[fo ┃o]]
                  [[bar]]
          md      - top
                    - [[fo o]]
                    - [[bar]]

        pos 13
          before  top
                  [[foo┃]]
                  [[bar]]
          after   top
                  [[foo ┃]]
                  [[bar]]
          md      - top
                    - [[foo ]]
                    - [[bar]]

        pos 14
          before  top
                  [[foo]┃]
                  [[bar]]
          after   top
                  [[foo] ┃]
                  [[bar]]
          md      - top
                    - [[foo] ]
                    - [[bar]]

        pos 15
          before  top
                  [[foo]]┃
                  [[bar]]
          after   top
                  [[foo]] ┃
                  [[bar]]
          md      - top
                    - [[foo]]·
                    - [[bar]]

        pos 19
          before  top
                  [[foo]]
                  ┃[[bar]]
          after   top
                  [[foo]]
                   ┃[[bar]]
          md      - top
                    - [[foo]]
                    -  [[bar]]

        pos 20
          before  top
                  [[foo]]
                  [┃[bar]]
          after   top
                  [[foo]]
                  [ ┃[bar]]
          md      - top
                    - [[foo]]
                    - [ [bar]]

        pos 21
          before  top
                  [[foo]]
                  [[┃bar]]
          after   top
                  [[foo]]
                  [[ ┃bar]]
          md      - top
                    - [[foo]]
                    - [[ bar]]

        pos 22
          before  top
                  [[foo]]
                  [[b┃ar]]
          after   top
                  [[foo]]
                  [[b ┃ar]]
          md      - top
                    - [[foo]]
                    - [[b ar]]

        pos 23
          before  top
                  [[foo]]
                  [[ba┃r]]
          after   top
                  [[foo]]
                  [[ba ┃r]]
          md      - top
                    - [[foo]]
                    - [[ba r]]

        pos 24
          before  top
                  [[foo]]
                  [[bar┃]]
          after   top
                  [[foo]]
                  [[bar ┃]]
          md      - top
                    - [[foo]]
                    - [[bar ]]

        pos 25
          before  top
                  [[foo]]
                  [[bar]┃]
          after   top
                  [[foo]]
                  [[bar] ┃]
          md      - top
                    - [[foo]]
                    - [[bar] ]

        pos 26
          before  top
                  [[foo]]
                  [[bar]]┃
          after   top
                  [[foo]]
                  [[bar]] ┃
          md      - top
                    - [[foo]]
                    - [[bar]]
        """
      `)
    },
    FUZZ_TIMEOUT,
  )

  it(
    'records Enter at every caret position',
    async () => {
      expect(await fuzzKey('hide', OUTLINE_MARKDOWN, '{Enter}')).toMatchInlineSnapshot(`
        """
        pos 2
          before  ┃top
                  [[foo]]
                  [[bar]]
          after
                  ┃top
                  [[foo]]
                  [[bar]]
          md      -
                  - top
                    - [[foo]]
                    - [[bar]]

        pos 3
          before  t┃op
                  [[foo]]
                  [[bar]]
          after   t
                  ┃op
                  [[foo]]
                  [[bar]]
          md      - t
                  - op
                    - [[foo]]
                    - [[bar]]

        pos 4
          before  to┃p
                  [[foo]]
                  [[bar]]
          after   to
                  ┃p
                  [[foo]]
                  [[bar]]
          md      - to
                  - p
                    - [[foo]]
                    - [[bar]]

        pos 5
          before  top┃
                  [[foo]]
                  [[bar]]
          after   top
                  ┃
                  [[foo]]
                  [[bar]]
          md      - top
                  -
                    - [[foo]]
                    - [[bar]]

        pos 8
          before  top
                  ┃[[foo]]
                  [[bar]]
          after   top

                  ┃[[foo]]
                  [[bar]]
          md      - top
                    -
                    - [[foo]]
                    - [[bar]]

        pos 9
          before  top
                  [┃[foo]]
                  [[bar]]
          after   top
                  [
                  ┃[foo]]
                  [[bar]]
          md      - top
                    - [
                    - [foo]]
                    - [[bar]]

        pos 10
          before  top
                  [[┃foo]]
                  [[bar]]
          after   top
                  [[
                  ┃foo]]
                  [[bar]]
          md      - top
                    - [[
                    - foo]]
                    - [[bar]]

        pos 11
          before  top
                  [[f┃oo]]
                  [[bar]]
          after   top
                  [[f
                  ┃oo]]
                  [[bar]]
          md      - top
                    - [[f
                    - oo]]
                    - [[bar]]

        pos 12
          before  top
                  [[fo┃o]]
                  [[bar]]
          after   top
                  [[fo
                  ┃o]]
                  [[bar]]
          md      - top
                    - [[fo
                    - o]]
                    - [[bar]]

        pos 13
          before  top
                  [[foo┃]]
                  [[bar]]
          after   top
                  [[foo
                  ┃]]
                  [[bar]]
          md      - top
                    - [[foo
                    - ]]
                    - [[bar]]

        pos 14
          before  top
                  [[foo]┃]
                  [[bar]]
          after   top
                  [[foo]
                  ┃]
                  [[bar]]
          md      - top
                    - [[foo]
                    - ]
                    - [[bar]]

        pos 15
          before  top
                  [[foo]]┃
                  [[bar]]
          after   top
                  [[foo]]
                  ┃
                  [[bar]]
          md      - top
                    - [[foo]]
                    -
                    - [[bar]]

        pos 19
          before  top
                  [[foo]]
                  ┃[[bar]]
          after   top
                  [[foo]]

                  ┃[[bar]]
          md      - top
                    - [[foo]]
                    -
                    - [[bar]]

        pos 20
          before  top
                  [[foo]]
                  [┃[bar]]
          after   top
                  [[foo]]
                  [
                  ┃[bar]]
          md      - top
                    - [[foo]]
                    - [
                    - [bar]]

        pos 21
          before  top
                  [[foo]]
                  [[┃bar]]
          after   top
                  [[foo]]
                  [[
                  ┃bar]]
          md      - top
                    - [[foo]]
                    - [[
                    - bar]]

        pos 22
          before  top
                  [[foo]]
                  [[b┃ar]]
          after   top
                  [[foo]]
                  [[b
                  ┃ar]]
          md      - top
                    - [[foo]]
                    - [[b
                    - ar]]

        pos 23
          before  top
                  [[foo]]
                  [[ba┃r]]
          after   top
                  [[foo]]
                  [[ba
                  ┃r]]
          md      - top
                    - [[foo]]
                    - [[ba
                    - r]]

        pos 24
          before  top
                  [[foo]]
                  [[bar┃]]
          after   top
                  [[foo]]
                  [[bar
                  ┃]]
          md      - top
                    - [[foo]]
                    - [[bar
                    - ]]

        pos 25
          before  top
                  [[foo]]
                  [[bar]┃]
          after   top
                  [[foo]]
                  [[bar]
                  ┃]
          md      - top
                    - [[foo]]
                    - [[bar]
                    - ]

        pos 26
          before  top
                  [[foo]]
                  [[bar]]┃
          after   top
                  [[foo]]
                  [[bar]]
                  ┃
          md      - top
                    - [[foo]]
                    - [[bar]]
                    -
        """
      `)
    },
    FUZZ_TIMEOUT,
  )
})

describe('caret fuzz over a wikilink inside a paragraph in focus mode', () => {
  it(
    'records Backspace at every caret position',
    async () => {
      expect(await fuzzKey('focus', INLINE_MARKDOWN, '{Backspace}')).toMatchInlineSnapshot(`
        """
        pos 1
          before  ┃a [[foo]] b
          after   ┃a [[foo]] b
          md      a [[foo]] b

        pos 2
          before  a┃ [[foo]] b
          after   ┃ [[foo]] b
          md       [[foo]] b

        pos 3
          before  a ┃[[foo]] b
          after   a┃[[foo]] b
          md      a[[foo]] b

        pos 4
          before  a [┃[foo]] b
          after   a ┃[foo]] b
          md      a [foo]] b

        pos 5
          before  a [[┃foo]] b
          after   a [┃foo]] b
          md      a [foo]] b

        pos 6
          before  a [[f┃oo]] b
          after   a [[┃oo]] b
          md      a [[oo]] b

        pos 7
          before  a [[fo┃o]] b
          after   a [[f┃o]] b
          md      a [[fo]] b

        pos 8
          before  a [[foo┃]] b
          after   a [[fo┃]] b
          md      a [[fo]] b

        pos 9
          before  a [[foo]┃] b
          after   a [[foo┃] b
          md      a [[foo] b

        pos 10
          before  a [[foo]]┃ b
          after   a ┃ b
          md      a  b

        pos 11
          before  a [[foo]] ┃b
          after   a [[foo]]┃b
          md      a [[foo]]b

        pos 12
          before  a [[foo]] b┃
          after   a [[foo]] ┃
          md      a [[foo]]
        """
      `)
    },
    FUZZ_TIMEOUT,
  )

  it(
    'records Space at every caret position',
    async () => {
      expect(await fuzzKey('focus', INLINE_MARKDOWN, ' ')).toMatchInlineSnapshot(`
        """
        pos 1
          before  ┃a [[foo]] b
          after    ┃a [[foo]] b
          md       a [[foo]] b

        pos 2
          before  a┃ [[foo]] b
          after   a ┃ [[foo]] b
          md      a  [[foo]] b

        pos 3
          before  a ┃[[foo]] b
          after   a  ┃[[foo]] b
          md      a  [[foo]] b

        pos 4
          before  a [┃[foo]] b
          after   a [ ┃[foo]] b
          md      a [ [foo]] b

        pos 5
          before  a [[┃foo]] b
          after   a [[ ┃foo]] b
          md      a [[ foo]] b

        pos 6
          before  a [[f┃oo]] b
          after   a [[f ┃oo]] b
          md      a [[f oo]] b

        pos 7
          before  a [[fo┃o]] b
          after   a [[fo ┃o]] b
          md      a [[fo o]] b

        pos 8
          before  a [[foo┃]] b
          after   a [[foo ┃]] b
          md      a [[foo ]] b

        pos 9
          before  a [[foo]┃] b
          after   a [[foo] ┃] b
          md      a [[foo] ] b

        pos 10
          before  a [[foo]]┃ b
          after   a [[foo]] ┃ b
          md      a [[foo]]  b

        pos 11
          before  a [[foo]] ┃b
          after   a [[foo]]  ┃b
          md      a [[foo]]  b

        pos 12
          before  a [[foo]] b┃
          after   a [[foo]] b ┃
          md      a [[foo]] b
        """
      `)
    },
    FUZZ_TIMEOUT,
  )

  it(
    'records Enter at every caret position',
    async () => {
      expect(await fuzzKey('focus', INLINE_MARKDOWN, '{Enter}')).toMatchInlineSnapshot(`
        """
        pos 1
          before  ┃a [[foo]] b
          after
                  ┃a [[foo]] b
          md      a [[foo]] b

        pos 2
          before  a┃ [[foo]] b
          after   a
                  ┃ [[foo]] b
          md      a

                   [[foo]] b

        pos 3
          before  a ┃[[foo]] b
          after   a·
                  ┃[[foo]] b
          md      a·

                  [[foo]] b

        pos 4
          before  a [┃[foo]] b
          after   a [
                  ┃[foo]] b
          md      a [

                  [foo]] b

        pos 5
          before  a [[┃foo]] b
          after   a [[
                  ┃foo]] b
          md      a [[

                  foo]] b

        pos 6
          before  a [[f┃oo]] b
          after   a [[f
                  ┃oo]] b
          md      a [[f

                  oo]] b

        pos 7
          before  a [[fo┃o]] b
          after   a [[fo
                  ┃o]] b
          md      a [[fo

                  o]] b

        pos 8
          before  a [[foo┃]] b
          after   a [[foo
                  ┃]] b
          md      a [[foo

                  ]] b

        pos 9
          before  a [[foo]┃] b
          after   a [[foo]
                  ┃] b
          md      a [[foo]

                  ] b

        pos 10
          before  a [[foo]]┃ b
          after   a [[foo]]
                  ┃ b
          md      a [[foo]]

                   b

        pos 11
          before  a [[foo]] ┃b
          after   a [[foo]]·
                  ┃b
          md      a [[foo]]·

                  b

        pos 12
          before  a [[foo]] b┃
          after   a [[foo]] b
                  ┃
          md      a [[foo]] b
        """
      `)
    },
    FUZZ_TIMEOUT,
  )
})

describe('caret fuzz over two adjacent wikilinks in focus mode', () => {
  it(
    'records Backspace at every caret position',
    async () => {
      expect(await fuzzKey('focus', ADJACENT_MARKDOWN, '{Backspace}')).toMatchInlineSnapshot(`
          """
          pos 1
            before  ┃[[foo]][[bar]]
            after   ┃[[foo]][[bar]]
            md      [[foo]][[bar]]

          pos 2
            before  [┃[foo]][[bar]]
            after   ┃[foo]][[bar]]
            md      [foo]][[bar]]

          pos 3
            before  [[┃foo]][[bar]]
            after   [┃foo]][[bar]]
            md      [foo]][[bar]]

          pos 4
            before  [[f┃oo]][[bar]]
            after   [[┃oo]][[bar]]
            md      [[oo]][[bar]]

          pos 5
            before  [[fo┃o]][[bar]]
            after   [[f┃o]][[bar]]
            md      [[fo]][[bar]]

          pos 6
            before  [[foo┃]][[bar]]
            after   [[fo┃]][[bar]]
            md      [[fo]][[bar]]

          pos 7
            before  [[foo]┃][[bar]]
            after   [[foo┃][[bar]]
            md      [[foo][[bar]]

          pos 8
            before  [[foo]]┃[[bar]]
            after   ┃[[bar]]
            md      [[bar]]

          pos 9
            before  [[foo]][┃[bar]]
            after   [[foo]]┃[bar]]
            md      [[foo]][bar]]

          pos 10
            before  [[foo]][[┃bar]]
            after   [[foo]][┃bar]]
            md      [[foo]][bar]]

          pos 11
            before  [[foo]][[b┃ar]]
            after   [[foo]][[┃ar]]
            md      [[foo]][[ar]]

          pos 12
            before  [[foo]][[ba┃r]]
            after   [[foo]][[b┃r]]
            md      [[foo]][[br]]

          pos 13
            before  [[foo]][[bar┃]]
            after   [[foo]][[ba┃]]
            md      [[foo]][[ba]]

          pos 14
            before  [[foo]][[bar]┃]
            after   [[foo]][[bar┃]
            md      [[foo]][[bar]

          pos 15
            before  [[foo]][[bar]]┃
            after   [[foo]]┃
            md      [[foo]]
          """
        `)
    },
    FUZZ_TIMEOUT,
  )

  it(
    'records Space at every caret position',
    async () => {
      expect(await fuzzKey('focus', ADJACENT_MARKDOWN, ' ')).toMatchInlineSnapshot(`
        """
        pos 1
          before  ┃[[foo]][[bar]]
          after    ┃[[foo]][[bar]]
          md       [[foo]][[bar]]

        pos 2
          before  [┃[foo]][[bar]]
          after   [ ┃[foo]][[bar]]
          md      [ [foo]][[bar]]

        pos 3
          before  [[┃foo]][[bar]]
          after   [[ ┃foo]][[bar]]
          md      [[ foo]][[bar]]

        pos 4
          before  [[f┃oo]][[bar]]
          after   [[f ┃oo]][[bar]]
          md      [[f oo]][[bar]]

        pos 5
          before  [[fo┃o]][[bar]]
          after   [[fo ┃o]][[bar]]
          md      [[fo o]][[bar]]

        pos 6
          before  [[foo┃]][[bar]]
          after   [[foo ┃]][[bar]]
          md      [[foo ]][[bar]]

        pos 7
          before  [[foo]┃][[bar]]
          after   [[foo] ┃][[bar]]
          md      [[foo] ][[bar]]

        pos 8
          before  [[foo]]┃[[bar]]
          after   [[foo]] ┃[[bar]]
          md      [[foo]] [[bar]]

        pos 9
          before  [[foo]][┃[bar]]
          after   [[foo]][ ┃[bar]]
          md      [[foo]][ [bar]]

        pos 10
          before  [[foo]][[┃bar]]
          after   [[foo]][[ ┃bar]]
          md      [[foo]][[ bar]]

        pos 11
          before  [[foo]][[b┃ar]]
          after   [[foo]][[b ┃ar]]
          md      [[foo]][[b ar]]

        pos 12
          before  [[foo]][[ba┃r]]
          after   [[foo]][[ba ┃r]]
          md      [[foo]][[ba r]]

        pos 13
          before  [[foo]][[bar┃]]
          after   [[foo]][[bar ┃]]
          md      [[foo]][[bar ]]

        pos 14
          before  [[foo]][[bar]┃]
          after   [[foo]][[bar] ┃]
          md      [[foo]][[bar] ]

        pos 15
          before  [[foo]][[bar]]┃
          after   [[foo]][[bar]] ┃
          md      [[foo]][[bar]]
        """
      `)
    },
    FUZZ_TIMEOUT,
  )

  it(
    'records Enter at every caret position',
    async () => {
      expect(await fuzzKey('focus', ADJACENT_MARKDOWN, '{Enter}')).toMatchInlineSnapshot(`
        """
        pos 1
          before  ┃[[foo]][[bar]]
          after
                  ┃[[foo]][[bar]]
          md      [[foo]][[bar]]

        pos 2
          before  [┃[foo]][[bar]]
          after   [
                  ┃[foo]][[bar]]
          md      [

                  [foo]][[bar]]

        pos 3
          before  [[┃foo]][[bar]]
          after   [[
                  ┃foo]][[bar]]
          md      [[

                  foo]][[bar]]

        pos 4
          before  [[f┃oo]][[bar]]
          after   [[f
                  ┃oo]][[bar]]
          md      [[f

                  oo]][[bar]]

        pos 5
          before  [[fo┃o]][[bar]]
          after   [[fo
                  ┃o]][[bar]]
          md      [[fo

                  o]][[bar]]

        pos 6
          before  [[foo┃]][[bar]]
          after   [[foo
                  ┃]][[bar]]
          md      [[foo

                  ]][[bar]]

        pos 7
          before  [[foo]┃][[bar]]
          after   [[foo]
                  ┃][[bar]]
          md      [[foo]

                  ][[bar]]

        pos 8
          before  [[foo]]┃[[bar]]
          after   [[foo]]
                  ┃[[bar]]
          md      [[foo]]

                  [[bar]]

        pos 9
          before  [[foo]][┃[bar]]
          after   [[foo]][
                  ┃[bar]]
          md      [[foo]][

                  [bar]]

        pos 10
          before  [[foo]][[┃bar]]
          after   [[foo]][[
                  ┃bar]]
          md      [[foo]][[

                  bar]]

        pos 11
          before  [[foo]][[b┃ar]]
          after   [[foo]][[b
                  ┃ar]]
          md      [[foo]][[b

                  ar]]

        pos 12
          before  [[foo]][[ba┃r]]
          after   [[foo]][[ba
                  ┃r]]
          md      [[foo]][[ba

                  r]]

        pos 13
          before  [[foo]][[bar┃]]
          after   [[foo]][[bar
                  ┃]]
          md      [[foo]][[bar

                  ]]

        pos 14
          before  [[foo]][[bar]┃]
          after   [[foo]][[bar]
                  ┃]
          md      [[foo]][[bar]

                  ]

        pos 15
          before  [[foo]][[bar]]┃
          after   [[foo]][[bar]]
                  ┃
          md      [[foo]][[bar]]
        """
      `)
    },
    FUZZ_TIMEOUT,
  )
})
