import { isFirefox, isSafari } from '@meowdown/vitest/helpers'
import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { getSelectionSnapshot, setupFixture, type Fixture } from '../testing/index.ts'

import type { MarkMode } from './mark-mode.ts'

const pmRoot = page.locate('.ProseMirror')

const FUZZ_TIMEOUT = 300_000

// Block separator inside a snapshot row, so one caret position stays one line.
const BLOCK_BREAK = '⏎'

function flatten(text: string): string {
  return text.replaceAll('\n', BLOCK_BREAK)
}

interface CaretCase {
  label: string
  lines: string[]
}

// Every caret position in `lines`: one case per offset of every line, with the
// `<a>` tag inserted there. Offsets inside a wikilink's hidden `[[` / `]]`
// source are included on purpose: the editor should keep the caret out of
// them, but a bug can put it there.
function buildCaretCases(lines: readonly string[]): CaretCase[] {
  const cases: CaretCase[] = []
  for (const [lineIndex, line] of lines.entries()) {
    for (let offset = 0; offset <= line.length; offset++) {
      cases.push({
        label: `${lineIndex}:${String(offset).padStart(2, '0')}`,
        lines: lines.map((text, index) =>
          index === lineIndex ? `${text.slice(0, offset)}<a>${text.slice(offset)}` : text,
        ),
      })
    }
  }
  return cases
  // REVIEW: do not use <a> in the test source, because it's not super reliable to parse and serialize. Use a more low-level API. use prosemirror's API to directly set the text selection. for every position `pos`, use `Selection.near($pos)` to get a selection, and if (a) the output selection is `TextSelection` (e.g. not AllSelection not NodeSelection etc), and (b) the output selection is empty and its `selection.from` equals `pos`, then that position is a valid caret position. We pick all valid caret positions and run the fuzz test on them. This way we don't have to worry about the `<a>` tag being in a weird place, and we can be sure that the caret is actually in a valid position.
}

type SetupDoc = (lines: readonly string[]) => Fixture

// Press `key` once at every caret position of `lines`. Each position gets two
// rows: the selection before and after the press, then the markdown the
// document serializes to, which is where a lost list level or a dissolved
// wikilink shows up.
async function fuzzKey(setup: SetupDoc, lines: readonly string[], key: string): Promise<string> {
  const rows: string[] = []
  for (const caretCase of buildCaretCases(lines)) {
    using fixture = setup(caretCase.lines)
    await expect.element(pmRoot).toBeVisible()

    const before = flatten(getSelectionSnapshot(fixture.state))
    await userEvent.keyboard(key)
    const after = flatten(getSelectionSnapshot(fixture.state))

    rows.push(`${caretCase.label}  ${before}  ->  ${after}`)
    rows.push(`${' '.repeat(caretCase.label.length)}  md: ${flatten(docToMarkdown(fixture.doc))}`)
  }
  return rows.join('\n')
}

// The reported document: one bullet with two nested wikilink bullets.
const OUTLINE_LINES = ['Links', '[[wikilink 1]]', '[[wikilink 2]]']

function setupOutline(mode: MarkMode, lines: readonly string[]): Fixture {
  const fixture = setupFixture({ extensionOptions: { markMode: mode } })
  const { n } = fixture
  const [parent = '', ...children] = lines
  fixture.set(
    n.doc(
      n.list(
        { kind: 'bullet' },
        n.paragraph(parent),
        ...children.map((child) => n.list({ kind: 'bullet' }, n.paragraph(child))),
      ),
    ),
  )
  fixture.view.focus()
  return fixture
}

const setupFocusOutline: SetupDoc = (lines) => setupOutline('focus', lines)
const setupHideOutline: SetupDoc = (lines) => setupOutline('hide', lines)

const setupFocusParagraphs: SetupDoc = (lines) => {
  const fixture = setupFixture({ extensionOptions: { markMode: 'focus' } })
  const { n } = fixture
  fixture.set(n.doc(...lines.map((line) => n.paragraph(line))))
  fixture.view.focus()
  return fixture
}

describe('caret fuzz over a wikilink outline in focus mode', () => {
  it(
    'records Backspace at every caret position',
    async () => {
      const table = await fuzzKey(setupFocusOutline, OUTLINE_LINES, '{Backspace}')
      if (isSafari()) {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: Links⏎⏎- [[wikilink 1]]⏎- [[wikilink 2]]⏎
          0:01  L┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  ┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - inks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:02  Li┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  L┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Lnks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:03  Lin┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Li┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Liks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:04  Link┃s⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Lin┃s⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Lins⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:05  Links┃⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Link┃⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Link⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:00  Links⏎┃[[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎┃[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎⏎  [[wikilink 1]]⏎⏎  - [[wikilink 2]]⏎
          1:01  Links⏎[┃[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎┃[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:02  Links⏎[[┃wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[┃wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:03  Links⏎[[w┃ikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[┃ikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[ikilink 1]]⏎  - [[wikilink 2]]⏎
          1:04  Links⏎[[wi┃kilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[w┃kilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wkilink 1]]⏎  - [[wikilink 2]]⏎
          1:05  Links⏎[[wik┃ilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wi┃ilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wiilink 1]]⏎  - [[wikilink 2]]⏎
          1:06  Links⏎[[wiki┃link 1]]⏎[[wikilink 2]]  ->  Links⏎[[wik┃link 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wiklink 1]]⏎  - [[wikilink 2]]⏎
          1:07  Links⏎[[wikil┃ink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wiki┃ink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikiink 1]]⏎  - [[wikilink 2]]⏎
          1:08  Links⏎[[wikili┃nk 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikil┃nk 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilnk 1]]⏎  - [[wikilink 2]]⏎
          1:09  Links⏎[[wikilin┃k 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikili┃k 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilik 1]]⏎  - [[wikilink 2]]⏎
          1:10  Links⏎[[wikilink┃ 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilin┃ 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilin 1]]⏎  - [[wikilink 2]]⏎
          1:11  Links⏎[[wikilink ┃1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink┃1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink1]]⏎  - [[wikilink 2]]⏎
          1:12  Links⏎[[wikilink 1┃]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink ┃]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink ]]⏎  - [[wikilink 2]]⏎
          1:13  Links⏎[[wikilink 1]┃]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1┃]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]⏎  - [[wikilink 2]]⏎
          1:14  Links⏎[[wikilink 1]]┃⏎[[wikilink 2]]  ->  Links⏎┃⏎[[wikilink 2]]
                md: - Links⏎  -⏎  - [[wikilink 2]]⏎
          2:00  Links⏎[[wikilink 1]]⏎┃[[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎┃[[wikilink 2]]
                md: - Links⏎⏎  - [[wikilink 1]]⏎⏎  [[wikilink 2]]⏎
          2:01  Links⏎[[wikilink 1]]⏎[┃[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎┃[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [wikilink 2]]⏎
          2:02  Links⏎[[wikilink 1]]⏎[[┃wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[┃wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [wikilink 2]]⏎
          2:03  Links⏎[[wikilink 1]]⏎[[w┃ikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[┃ikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[ikilink 2]]⏎
          2:04  Links⏎[[wikilink 1]]⏎[[wi┃kilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[w┃kilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wkilink 2]]⏎
          2:05  Links⏎[[wikilink 1]]⏎[[wik┃ilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wi┃ilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wiilink 2]]⏎
          2:06  Links⏎[[wikilink 1]]⏎[[wiki┃link 2]]  ->  Links⏎[[wikilink 1]]⏎[[wik┃link 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wiklink 2]]⏎
          2:07  Links⏎[[wikilink 1]]⏎[[wikil┃ink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wiki┃ink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikiink 2]]⏎
          2:08  Links⏎[[wikilink 1]]⏎[[wikili┃nk 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikil┃nk 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilnk 2]]⏎
          2:09  Links⏎[[wikilink 1]]⏎[[wikilin┃k 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikili┃k 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilik 2]]⏎
          2:10  Links⏎[[wikilink 1]]⏎[[wikilink┃ 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilin┃ 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilin 2]]⏎
          2:11  Links⏎[[wikilink 1]]⏎[[wikilink ┃2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink┃2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink2]]⏎
          2:12  Links⏎[[wikilink 1]]⏎[[wikilink 2┃]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink ┃]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink ]]⏎
          2:13  Links⏎[[wikilink 1]]⏎[[wikilink 2]┃]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2┃]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]⏎
          2:14  Links⏎[[wikilink 1]]⏎[[wikilink 2]]┃  ->  Links⏎[[wikilink 1]]⏎┃
                md: - Links⏎  - [[wikilink 1]]⏎  -⏎
          """
        `)
      } else if (isFirefox()) {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: Links⏎⏎- [[wikilink 1]]⏎- [[wikilink 2]]⏎
          0:01  L┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  ┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - inks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:02  Li┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  L┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Lnks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:03  Lin┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Li┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Liks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:04  Link┃s⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Lin┃s⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Lins⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:05  Links┃⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Link┃⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Link⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:00  Links⏎┃[[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎┃[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎⏎  [[wikilink 1]]⏎⏎  - [[wikilink 2]]⏎
          1:01  Links⏎[┃[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎┃[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:02  Links⏎[[┃wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[┃wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:03  Links⏎[[w┃ikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[┃ikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[ikilink 1]]⏎  - [[wikilink 2]]⏎
          1:04  Links⏎[[wi┃kilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[w┃kilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wkilink 1]]⏎  - [[wikilink 2]]⏎
          1:05  Links⏎[[wik┃ilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wi┃ilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wiilink 1]]⏎  - [[wikilink 2]]⏎
          1:06  Links⏎[[wiki┃link 1]]⏎[[wikilink 2]]  ->  Links⏎[[wik┃link 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wiklink 1]]⏎  - [[wikilink 2]]⏎
          1:07  Links⏎[[wikil┃ink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wiki┃ink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikiink 1]]⏎  - [[wikilink 2]]⏎
          1:08  Links⏎[[wikili┃nk 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikil┃nk 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilnk 1]]⏎  - [[wikilink 2]]⏎
          1:09  Links⏎[[wikilin┃k 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikili┃k 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilik 1]]⏎  - [[wikilink 2]]⏎
          1:10  Links⏎[[wikilink┃ 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilin┃ 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilin 1]]⏎  - [[wikilink 2]]⏎
          1:11  Links⏎[[wikilink ┃1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink┃1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink1]]⏎  - [[wikilink 2]]⏎
          1:12  Links⏎[[wikilink 1┃]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink ┃]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink ]]⏎  - [[wikilink 2]]⏎
          1:13  Links⏎[[wikilink 1]┃]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1┃]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]⏎  - [[wikilink 2]]⏎
          1:14  Links⏎[[wikilink 1]]┃⏎[[wikilink 2]]  ->  Links⏎┃⏎[[wikilink 2]]
                md: - Links⏎  -⏎  - [[wikilink 2]]⏎
          2:00  Links⏎[[wikilink 1]]⏎┃[[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎┃[[wikilink 2]]
                md: - Links⏎⏎  - [[wikilink 1]]⏎⏎  [[wikilink 2]]⏎
          2:01  Links⏎[[wikilink 1]]⏎[┃[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎┃[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [wikilink 2]]⏎
          2:02  Links⏎[[wikilink 1]]⏎[[┃wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[┃wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [wikilink 2]]⏎
          2:03  Links⏎[[wikilink 1]]⏎[[w┃ikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[┃ikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[ikilink 2]]⏎
          2:04  Links⏎[[wikilink 1]]⏎[[wi┃kilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[w┃kilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wkilink 2]]⏎
          2:05  Links⏎[[wikilink 1]]⏎[[wik┃ilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wi┃ilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wiilink 2]]⏎
          2:06  Links⏎[[wikilink 1]]⏎[[wiki┃link 2]]  ->  Links⏎[[wikilink 1]]⏎[[wik┃link 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wiklink 2]]⏎
          2:07  Links⏎[[wikilink 1]]⏎[[wikil┃ink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wiki┃ink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikiink 2]]⏎
          2:08  Links⏎[[wikilink 1]]⏎[[wikili┃nk 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikil┃nk 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilnk 2]]⏎
          2:09  Links⏎[[wikilink 1]]⏎[[wikilin┃k 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikili┃k 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilik 2]]⏎
          2:10  Links⏎[[wikilink 1]]⏎[[wikilink┃ 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilin┃ 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilin 2]]⏎
          2:11  Links⏎[[wikilink 1]]⏎[[wikilink ┃2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink┃2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink2]]⏎
          2:12  Links⏎[[wikilink 1]]⏎[[wikilink 2┃]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink ┃]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink ]]⏎
          2:13  Links⏎[[wikilink 1]]⏎[[wikilink 2]┃]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2┃]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]⏎
          2:14  Links⏎[[wikilink 1]]⏎[[wikilink 2]]┃  ->  Links⏎[[wikilink 1]]⏎┃
                md: - Links⏎  - [[wikilink 1]]⏎  -⏎
          """
        `)
      } else {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: Links⏎⏎- [[wikilink 1]]⏎- [[wikilink 2]]⏎
          0:01  L┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  ┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - inks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:02  Li┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  L┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Lnks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:03  Lin┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Li┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Liks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:04  Link┃s⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Lin┃s⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Lins⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:05  Links┃⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Link┃⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Link⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:00  Links⏎┃[[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎┃[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎⏎  [[wikilink 1]]⏎⏎  - [[wikilink 2]]⏎
          1:01  Links⏎[┃[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎┃[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:02  Links⏎[[┃wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[┃wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:03  Links⏎[[w┃ikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[┃ikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[ikilink 1]]⏎  - [[wikilink 2]]⏎
          1:04  Links⏎[[wi┃kilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[w┃kilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wkilink 1]]⏎  - [[wikilink 2]]⏎
          1:05  Links⏎[[wik┃ilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wi┃ilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wiilink 1]]⏎  - [[wikilink 2]]⏎
          1:06  Links⏎[[wiki┃link 1]]⏎[[wikilink 2]]  ->  Links⏎[[wik┃link 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wiklink 1]]⏎  - [[wikilink 2]]⏎
          1:07  Links⏎[[wikil┃ink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wiki┃ink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikiink 1]]⏎  - [[wikilink 2]]⏎
          1:08  Links⏎[[wikili┃nk 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikil┃nk 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilnk 1]]⏎  - [[wikilink 2]]⏎
          1:09  Links⏎[[wikilin┃k 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikili┃k 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilik 1]]⏎  - [[wikilink 2]]⏎
          1:10  Links⏎[[wikilink┃ 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilin┃ 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilin 1]]⏎  - [[wikilink 2]]⏎
          1:11  Links⏎[[wikilink ┃1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink┃1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink1]]⏎  - [[wikilink 2]]⏎
          1:12  Links⏎[[wikilink 1┃]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink ┃]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink ]]⏎  - [[wikilink 2]]⏎
          1:13  Links⏎[[wikilink 1]┃]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1┃]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]⏎  - [[wikilink 2]]⏎
          1:14  Links⏎[[wikilink 1]]┃⏎[[wikilink 2]]  ->  Links⏎┃⏎[[wikilink 2]]
                md: - Links⏎  -⏎  - [[wikilink 2]]⏎
          2:00  Links⏎[[wikilink 1]]⏎┃[[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎┃[[wikilink 2]]
                md: - Links⏎⏎  - [[wikilink 1]]⏎⏎  [[wikilink 2]]⏎
          2:01  Links⏎[[wikilink 1]]⏎[┃[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎┃[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [wikilink 2]]⏎
          2:02  Links⏎[[wikilink 1]]⏎[[┃wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[┃wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [wikilink 2]]⏎
          2:03  Links⏎[[wikilink 1]]⏎[[w┃ikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[┃ikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[ikilink 2]]⏎
          2:04  Links⏎[[wikilink 1]]⏎[[wi┃kilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[w┃kilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wkilink 2]]⏎
          2:05  Links⏎[[wikilink 1]]⏎[[wik┃ilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wi┃ilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wiilink 2]]⏎
          2:06  Links⏎[[wikilink 1]]⏎[[wiki┃link 2]]  ->  Links⏎[[wikilink 1]]⏎[[wik┃link 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wiklink 2]]⏎
          2:07  Links⏎[[wikilink 1]]⏎[[wikil┃ink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wiki┃ink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikiink 2]]⏎
          2:08  Links⏎[[wikilink 1]]⏎[[wikili┃nk 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikil┃nk 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilnk 2]]⏎
          2:09  Links⏎[[wikilink 1]]⏎[[wikilin┃k 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikili┃k 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilik 2]]⏎
          2:10  Links⏎[[wikilink 1]]⏎[[wikilink┃ 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilin┃ 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilin 2]]⏎
          2:11  Links⏎[[wikilink 1]]⏎[[wikilink ┃2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink┃2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink2]]⏎
          2:12  Links⏎[[wikilink 1]]⏎[[wikilink 2┃]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink ┃]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink ]]⏎
          2:13  Links⏎[[wikilink 1]]⏎[[wikilink 2]┃]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2┃]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]⏎
          2:14  Links⏎[[wikilink 1]]⏎[[wikilink 2]]┃  ->  Links⏎[[wikilink 1]]⏎┃
                md: - Links⏎  - [[wikilink 1]]⏎  -⏎
          """
        `)
      }
    },
    FUZZ_TIMEOUT,
  )

  it(
    'records Space at every caret position',
    async () => {
      const table = await fuzzKey(setupFocusOutline, OUTLINE_LINES, ' ')
      if (isSafari()) {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]  ->   ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: -  Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:01  L┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  L ┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - L inks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:02  Li┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Li ┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Li nks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:03  Lin┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Lin ┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Lin ks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:04  Link┃s⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Link ┃s⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Link s⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:05  Links┃⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Links ┃⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links ⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:00  Links⏎┃[[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎ ┃[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  -  [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:01  Links⏎[┃[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[ ┃[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [ [wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:02  Links⏎[[┃wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[ ┃wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[ wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:03  Links⏎[[w┃ikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[w ┃ikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[w ikilink 1]]⏎  - [[wikilink 2]]⏎
          1:04  Links⏎[[wi┃kilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wi ┃kilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wi kilink 1]]⏎  - [[wikilink 2]]⏎
          1:05  Links⏎[[wik┃ilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wik ┃ilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wik ilink 1]]⏎  - [[wikilink 2]]⏎
          1:06  Links⏎[[wiki┃link 1]]⏎[[wikilink 2]]  ->  Links⏎[[wiki ┃link 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wiki link 1]]⏎  - [[wikilink 2]]⏎
          1:07  Links⏎[[wikil┃ink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikil ┃ink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikil ink 1]]⏎  - [[wikilink 2]]⏎
          1:08  Links⏎[[wikili┃nk 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikili ┃nk 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikili nk 1]]⏎  - [[wikilink 2]]⏎
          1:09  Links⏎[[wikilin┃k 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilin ┃k 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilin k 1]]⏎  - [[wikilink 2]]⏎
          1:10  Links⏎[[wikilink┃ 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink ┃ 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink  1]]⏎  - [[wikilink 2]]⏎
          1:11  Links⏎[[wikilink ┃1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink  ┃1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink  1]]⏎  - [[wikilink 2]]⏎
          1:12  Links⏎[[wikilink 1┃]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1 ┃]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1 ]]⏎  - [[wikilink 2]]⏎
          1:13  Links⏎[[wikilink 1]┃]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1] ┃]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1] ]⏎  - [[wikilink 2]]⏎
          1:14  Links⏎[[wikilink 1]]┃⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1]] ┃⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]] ⏎  - [[wikilink 2]]⏎
          2:00  Links⏎[[wikilink 1]]⏎┃[[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎ ┃[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  -  [[wikilink 2]]⏎
          2:01  Links⏎[[wikilink 1]]⏎[┃[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[ ┃[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [ [wikilink 2]]⏎
          2:02  Links⏎[[wikilink 1]]⏎[[┃wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[ ┃wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[ wikilink 2]]⏎
          2:03  Links⏎[[wikilink 1]]⏎[[w┃ikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[w ┃ikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[w ikilink 2]]⏎
          2:04  Links⏎[[wikilink 1]]⏎[[wi┃kilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wi ┃kilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wi kilink 2]]⏎
          2:05  Links⏎[[wikilink 1]]⏎[[wik┃ilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wik ┃ilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wik ilink 2]]⏎
          2:06  Links⏎[[wikilink 1]]⏎[[wiki┃link 2]]  ->  Links⏎[[wikilink 1]]⏎[[wiki ┃link 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wiki link 2]]⏎
          2:07  Links⏎[[wikilink 1]]⏎[[wikil┃ink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikil ┃ink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikil ink 2]]⏎
          2:08  Links⏎[[wikilink 1]]⏎[[wikili┃nk 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikili ┃nk 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikili nk 2]]⏎
          2:09  Links⏎[[wikilink 1]]⏎[[wikilin┃k 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilin ┃k 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilin k 2]]⏎
          2:10  Links⏎[[wikilink 1]]⏎[[wikilink┃ 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink ┃ 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink  2]]⏎
          2:11  Links⏎[[wikilink 1]]⏎[[wikilink ┃2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink  ┃2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink  2]]⏎
          2:12  Links⏎[[wikilink 1]]⏎[[wikilink 2┃]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2 ┃]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2 ]]⏎
          2:13  Links⏎[[wikilink 1]]⏎[[wikilink 2]┃]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2] ┃]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2] ]⏎
          2:14  Links⏎[[wikilink 1]]⏎[[wikilink 2]]┃  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2]] ┃
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          """
        `)
      } else if (isFirefox()) {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]  ->   ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: -  Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:01  L┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  L ┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - L inks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:02  Li┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Li ┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Li nks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:03  Lin┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Lin ┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Lin ks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:04  Link┃s⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Link ┃s⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Link s⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:05  Links┃⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Links ┃⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links ⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:00  Links⏎┃[[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎ ┃[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  -  [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:01  Links⏎[┃[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[ ┃[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [ [wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:02  Links⏎[[┃wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[ ┃wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[ wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:03  Links⏎[[w┃ikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[w ┃ikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[w ikilink 1]]⏎  - [[wikilink 2]]⏎
          1:04  Links⏎[[wi┃kilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wi ┃kilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wi kilink 1]]⏎  - [[wikilink 2]]⏎
          1:05  Links⏎[[wik┃ilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wik ┃ilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wik ilink 1]]⏎  - [[wikilink 2]]⏎
          1:06  Links⏎[[wiki┃link 1]]⏎[[wikilink 2]]  ->  Links⏎[[wiki ┃link 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wiki link 1]]⏎  - [[wikilink 2]]⏎
          1:07  Links⏎[[wikil┃ink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikil ┃ink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikil ink 1]]⏎  - [[wikilink 2]]⏎
          1:08  Links⏎[[wikili┃nk 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikili ┃nk 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikili nk 1]]⏎  - [[wikilink 2]]⏎
          1:09  Links⏎[[wikilin┃k 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilin ┃k 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilin k 1]]⏎  - [[wikilink 2]]⏎
          1:10  Links⏎[[wikilink┃ 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink ┃ 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink  1]]⏎  - [[wikilink 2]]⏎
          1:11  Links⏎[[wikilink ┃1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink  ┃1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink  1]]⏎  - [[wikilink 2]]⏎
          1:12  Links⏎[[wikilink 1┃]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1 ┃]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1 ]]⏎  - [[wikilink 2]]⏎
          1:13  Links⏎[[wikilink 1]┃]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1] ┃]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1] ]⏎  - [[wikilink 2]]⏎
          1:14  Links⏎[[wikilink 1]]┃⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1]] ┃⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]] ⏎  - [[wikilink 2]]⏎
          2:00  Links⏎[[wikilink 1]]⏎┃[[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎ ┃[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  -  [[wikilink 2]]⏎
          2:01  Links⏎[[wikilink 1]]⏎[┃[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[ ┃[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [ [wikilink 2]]⏎
          2:02  Links⏎[[wikilink 1]]⏎[[┃wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[ ┃wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[ wikilink 2]]⏎
          2:03  Links⏎[[wikilink 1]]⏎[[w┃ikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[w ┃ikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[w ikilink 2]]⏎
          2:04  Links⏎[[wikilink 1]]⏎[[wi┃kilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wi ┃kilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wi kilink 2]]⏎
          2:05  Links⏎[[wikilink 1]]⏎[[wik┃ilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wik ┃ilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wik ilink 2]]⏎
          2:06  Links⏎[[wikilink 1]]⏎[[wiki┃link 2]]  ->  Links⏎[[wikilink 1]]⏎[[wiki ┃link 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wiki link 2]]⏎
          2:07  Links⏎[[wikilink 1]]⏎[[wikil┃ink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikil ┃ink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikil ink 2]]⏎
          2:08  Links⏎[[wikilink 1]]⏎[[wikili┃nk 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikili ┃nk 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikili nk 2]]⏎
          2:09  Links⏎[[wikilink 1]]⏎[[wikilin┃k 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilin ┃k 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilin k 2]]⏎
          2:10  Links⏎[[wikilink 1]]⏎[[wikilink┃ 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink ┃ 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink  2]]⏎
          2:11  Links⏎[[wikilink 1]]⏎[[wikilink ┃2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink  ┃2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink  2]]⏎
          2:12  Links⏎[[wikilink 1]]⏎[[wikilink 2┃]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2 ┃]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2 ]]⏎
          2:13  Links⏎[[wikilink 1]]⏎[[wikilink 2]┃]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2] ┃]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2] ]⏎
          2:14  Links⏎[[wikilink 1]]⏎[[wikilink 2]]┃  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2]] ┃
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          """
        `)
      } else {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]  ->   ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: -  Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:01  L┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  L ┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - L inks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:02  Li┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Li ┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Li nks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:03  Lin┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Lin ┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Lin ks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:04  Link┃s⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Link ┃s⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Link s⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:05  Links┃⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Links ┃⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links ⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:00  Links⏎┃[[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎ ┃[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  -  [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:01  Links⏎[┃[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[ ┃[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [ [wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:02  Links⏎[[┃wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[ ┃wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[ wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:03  Links⏎[[w┃ikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[w ┃ikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[w ikilink 1]]⏎  - [[wikilink 2]]⏎
          1:04  Links⏎[[wi┃kilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wi ┃kilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wi kilink 1]]⏎  - [[wikilink 2]]⏎
          1:05  Links⏎[[wik┃ilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wik ┃ilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wik ilink 1]]⏎  - [[wikilink 2]]⏎
          1:06  Links⏎[[wiki┃link 1]]⏎[[wikilink 2]]  ->  Links⏎[[wiki ┃link 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wiki link 1]]⏎  - [[wikilink 2]]⏎
          1:07  Links⏎[[wikil┃ink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikil ┃ink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikil ink 1]]⏎  - [[wikilink 2]]⏎
          1:08  Links⏎[[wikili┃nk 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikili ┃nk 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikili nk 1]]⏎  - [[wikilink 2]]⏎
          1:09  Links⏎[[wikilin┃k 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilin ┃k 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilin k 1]]⏎  - [[wikilink 2]]⏎
          1:10  Links⏎[[wikilink┃ 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink ┃ 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink  1]]⏎  - [[wikilink 2]]⏎
          1:11  Links⏎[[wikilink ┃1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink  ┃1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink  1]]⏎  - [[wikilink 2]]⏎
          1:12  Links⏎[[wikilink 1┃]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1 ┃]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1 ]]⏎  - [[wikilink 2]]⏎
          1:13  Links⏎[[wikilink 1]┃]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1] ┃]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1] ]⏎  - [[wikilink 2]]⏎
          1:14  Links⏎[[wikilink 1]]┃⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1]] ┃⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]] ⏎  - [[wikilink 2]]⏎
          2:00  Links⏎[[wikilink 1]]⏎┃[[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎ ┃[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  -  [[wikilink 2]]⏎
          2:01  Links⏎[[wikilink 1]]⏎[┃[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[ ┃[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [ [wikilink 2]]⏎
          2:02  Links⏎[[wikilink 1]]⏎[[┃wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[ ┃wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[ wikilink 2]]⏎
          2:03  Links⏎[[wikilink 1]]⏎[[w┃ikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[w ┃ikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[w ikilink 2]]⏎
          2:04  Links⏎[[wikilink 1]]⏎[[wi┃kilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wi ┃kilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wi kilink 2]]⏎
          2:05  Links⏎[[wikilink 1]]⏎[[wik┃ilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wik ┃ilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wik ilink 2]]⏎
          2:06  Links⏎[[wikilink 1]]⏎[[wiki┃link 2]]  ->  Links⏎[[wikilink 1]]⏎[[wiki ┃link 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wiki link 2]]⏎
          2:07  Links⏎[[wikilink 1]]⏎[[wikil┃ink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikil ┃ink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikil ink 2]]⏎
          2:08  Links⏎[[wikilink 1]]⏎[[wikili┃nk 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikili ┃nk 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikili nk 2]]⏎
          2:09  Links⏎[[wikilink 1]]⏎[[wikilin┃k 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilin ┃k 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilin k 2]]⏎
          2:10  Links⏎[[wikilink 1]]⏎[[wikilink┃ 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink ┃ 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink  2]]⏎
          2:11  Links⏎[[wikilink 1]]⏎[[wikilink ┃2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink  ┃2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink  2]]⏎
          2:12  Links⏎[[wikilink 1]]⏎[[wikilink 2┃]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2 ┃]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2 ]]⏎
          2:13  Links⏎[[wikilink 1]]⏎[[wikilink 2]┃]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2] ┃]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2] ]⏎
          2:14  Links⏎[[wikilink 1]]⏎[[wikilink 2]]┃  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2]] ┃
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          """
        `)
      }
    },
    FUZZ_TIMEOUT,
  )

  it(
    'records Enter at every caret position',
    async () => {
      const table = await fuzzKey(setupFocusOutline, OUTLINE_LINES, '{Enter}')
      if (isSafari()) {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  ⏎┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: -⏎- Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:01  L┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  L⏎┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - L⏎- inks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:02  Li┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Li⏎┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Li⏎- nks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:03  Lin┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Lin⏎┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Lin⏎- ks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:04  Link┃s⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Link⏎┃s⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Link⏎- s⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:05  Links┃⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎┃⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎-⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:00  Links⏎┃[[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎⏎┃[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  -⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:01  Links⏎[┃[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[⏎┃[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [⏎  - [wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:02  Links⏎[[┃wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[⏎┃wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[⏎  - wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:03  Links⏎[[w┃ikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[w⏎┃ikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[w⏎  - ikilink 1]]⏎  - [[wikilink 2]]⏎
          1:04  Links⏎[[wi┃kilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wi⏎┃kilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wi⏎  - kilink 1]]⏎  - [[wikilink 2]]⏎
          1:05  Links⏎[[wik┃ilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wik⏎┃ilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wik⏎  - ilink 1]]⏎  - [[wikilink 2]]⏎
          1:06  Links⏎[[wiki┃link 1]]⏎[[wikilink 2]]  ->  Links⏎[[wiki⏎┃link 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wiki⏎  - link 1]]⏎  - [[wikilink 2]]⏎
          1:07  Links⏎[[wikil┃ink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikil⏎┃ink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikil⏎  - ink 1]]⏎  - [[wikilink 2]]⏎
          1:08  Links⏎[[wikili┃nk 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikili⏎┃nk 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikili⏎  - nk 1]]⏎  - [[wikilink 2]]⏎
          1:09  Links⏎[[wikilin┃k 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilin⏎┃k 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilin⏎  - k 1]]⏎  - [[wikilink 2]]⏎
          1:10  Links⏎[[wikilink┃ 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink⏎┃ 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink⏎  -  1]]⏎  - [[wikilink 2]]⏎
          1:11  Links⏎[[wikilink ┃1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink ⏎┃1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink ⏎  - 1]]⏎  - [[wikilink 2]]⏎
          1:12  Links⏎[[wikilink 1┃]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1⏎┃]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1⏎  - ]]⏎  - [[wikilink 2]]⏎
          1:13  Links⏎[[wikilink 1]┃]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1]⏎┃]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]⏎  - ]⏎  - [[wikilink 2]]⏎
          1:14  Links⏎[[wikilink 1]]┃⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎┃⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  -⏎  - [[wikilink 2]]⏎
          2:00  Links⏎[[wikilink 1]]⏎┃[[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎⏎┃[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  -⏎  - [[wikilink 2]]⏎
          2:01  Links⏎[[wikilink 1]]⏎[┃[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[⏎┃[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [⏎  - [wikilink 2]]⏎
          2:02  Links⏎[[wikilink 1]]⏎[[┃wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[⏎┃wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[⏎  - wikilink 2]]⏎
          2:03  Links⏎[[wikilink 1]]⏎[[w┃ikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[w⏎┃ikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[w⏎  - ikilink 2]]⏎
          2:04  Links⏎[[wikilink 1]]⏎[[wi┃kilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wi⏎┃kilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wi⏎  - kilink 2]]⏎
          2:05  Links⏎[[wikilink 1]]⏎[[wik┃ilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wik⏎┃ilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wik⏎  - ilink 2]]⏎
          2:06  Links⏎[[wikilink 1]]⏎[[wiki┃link 2]]  ->  Links⏎[[wikilink 1]]⏎[[wiki⏎┃link 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wiki⏎  - link 2]]⏎
          2:07  Links⏎[[wikilink 1]]⏎[[wikil┃ink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikil⏎┃ink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikil⏎  - ink 2]]⏎
          2:08  Links⏎[[wikilink 1]]⏎[[wikili┃nk 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikili⏎┃nk 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikili⏎  - nk 2]]⏎
          2:09  Links⏎[[wikilink 1]]⏎[[wikilin┃k 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilin⏎┃k 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilin⏎  - k 2]]⏎
          2:10  Links⏎[[wikilink 1]]⏎[[wikilink┃ 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink⏎┃ 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink⏎  -  2]]⏎
          2:11  Links⏎[[wikilink 1]]⏎[[wikilink ┃2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink ⏎┃2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink ⏎  - 2]]⏎
          2:12  Links⏎[[wikilink 1]]⏎[[wikilink 2┃]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2⏎┃]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2⏎  - ]]⏎
          2:13  Links⏎[[wikilink 1]]⏎[[wikilink 2]┃]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2]⏎┃]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]⏎  - ]⏎
          2:14  Links⏎[[wikilink 1]]⏎[[wikilink 2]]┃  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2]]⏎┃
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎  -⏎
          """
        `)
      } else if (isFirefox()) {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  ⏎┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: -⏎- Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:01  L┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  L⏎┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - L⏎- inks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:02  Li┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Li⏎┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Li⏎- nks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:03  Lin┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Lin⏎┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Lin⏎- ks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:04  Link┃s⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Link⏎┃s⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Link⏎- s⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:05  Links┃⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎┃⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎-⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:00  Links⏎┃[[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎⏎┃[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  -⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:01  Links⏎[┃[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[⏎┃[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [⏎  - [wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:02  Links⏎[[┃wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[⏎┃wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[⏎  - wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:03  Links⏎[[w┃ikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[w⏎┃ikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[w⏎  - ikilink 1]]⏎  - [[wikilink 2]]⏎
          1:04  Links⏎[[wi┃kilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wi⏎┃kilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wi⏎  - kilink 1]]⏎  - [[wikilink 2]]⏎
          1:05  Links⏎[[wik┃ilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wik⏎┃ilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wik⏎  - ilink 1]]⏎  - [[wikilink 2]]⏎
          1:06  Links⏎[[wiki┃link 1]]⏎[[wikilink 2]]  ->  Links⏎[[wiki⏎┃link 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wiki⏎  - link 1]]⏎  - [[wikilink 2]]⏎
          1:07  Links⏎[[wikil┃ink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikil⏎┃ink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikil⏎  - ink 1]]⏎  - [[wikilink 2]]⏎
          1:08  Links⏎[[wikili┃nk 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikili⏎┃nk 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikili⏎  - nk 1]]⏎  - [[wikilink 2]]⏎
          1:09  Links⏎[[wikilin┃k 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilin⏎┃k 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilin⏎  - k 1]]⏎  - [[wikilink 2]]⏎
          1:10  Links⏎[[wikilink┃ 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink⏎┃ 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink⏎  -  1]]⏎  - [[wikilink 2]]⏎
          1:11  Links⏎[[wikilink ┃1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink ⏎┃1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink ⏎  - 1]]⏎  - [[wikilink 2]]⏎
          1:12  Links⏎[[wikilink 1┃]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1⏎┃]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1⏎  - ]]⏎  - [[wikilink 2]]⏎
          1:13  Links⏎[[wikilink 1]┃]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1]⏎┃]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]⏎  - ]⏎  - [[wikilink 2]]⏎
          1:14  Links⏎[[wikilink 1]]┃⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎┃⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  -⏎  - [[wikilink 2]]⏎
          2:00  Links⏎[[wikilink 1]]⏎┃[[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎⏎┃[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  -⏎  - [[wikilink 2]]⏎
          2:01  Links⏎[[wikilink 1]]⏎[┃[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[⏎┃[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [⏎  - [wikilink 2]]⏎
          2:02  Links⏎[[wikilink 1]]⏎[[┃wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[⏎┃wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[⏎  - wikilink 2]]⏎
          2:03  Links⏎[[wikilink 1]]⏎[[w┃ikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[w⏎┃ikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[w⏎  - ikilink 2]]⏎
          2:04  Links⏎[[wikilink 1]]⏎[[wi┃kilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wi⏎┃kilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wi⏎  - kilink 2]]⏎
          2:05  Links⏎[[wikilink 1]]⏎[[wik┃ilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wik⏎┃ilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wik⏎  - ilink 2]]⏎
          2:06  Links⏎[[wikilink 1]]⏎[[wiki┃link 2]]  ->  Links⏎[[wikilink 1]]⏎[[wiki⏎┃link 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wiki⏎  - link 2]]⏎
          2:07  Links⏎[[wikilink 1]]⏎[[wikil┃ink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikil⏎┃ink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikil⏎  - ink 2]]⏎
          2:08  Links⏎[[wikilink 1]]⏎[[wikili┃nk 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikili⏎┃nk 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikili⏎  - nk 2]]⏎
          2:09  Links⏎[[wikilink 1]]⏎[[wikilin┃k 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilin⏎┃k 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilin⏎  - k 2]]⏎
          2:10  Links⏎[[wikilink 1]]⏎[[wikilink┃ 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink⏎┃ 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink⏎  -  2]]⏎
          2:11  Links⏎[[wikilink 1]]⏎[[wikilink ┃2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink ⏎┃2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink ⏎  - 2]]⏎
          2:12  Links⏎[[wikilink 1]]⏎[[wikilink 2┃]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2⏎┃]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2⏎  - ]]⏎
          2:13  Links⏎[[wikilink 1]]⏎[[wikilink 2]┃]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2]⏎┃]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]⏎  - ]⏎
          2:14  Links⏎[[wikilink 1]]⏎[[wikilink 2]]┃  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2]]⏎┃
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎  -⏎
          """
        `)
      } else {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  ⏎┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: -⏎- Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:01  L┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  L⏎┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - L⏎- inks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:02  Li┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Li⏎┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Li⏎- nks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:03  Lin┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Lin⏎┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Lin⏎- ks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:04  Link┃s⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Link⏎┃s⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Link⏎- s⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:05  Links┃⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎┃⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎-⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:00  Links⏎┃[[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎⏎┃[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  -⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:01  Links⏎[┃[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[⏎┃[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [⏎  - [wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:02  Links⏎[[┃wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[⏎┃wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[⏎  - wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:03  Links⏎[[w┃ikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[w⏎┃ikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[w⏎  - ikilink 1]]⏎  - [[wikilink 2]]⏎
          1:04  Links⏎[[wi┃kilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wi⏎┃kilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wi⏎  - kilink 1]]⏎  - [[wikilink 2]]⏎
          1:05  Links⏎[[wik┃ilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wik⏎┃ilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wik⏎  - ilink 1]]⏎  - [[wikilink 2]]⏎
          1:06  Links⏎[[wiki┃link 1]]⏎[[wikilink 2]]  ->  Links⏎[[wiki⏎┃link 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wiki⏎  - link 1]]⏎  - [[wikilink 2]]⏎
          1:07  Links⏎[[wikil┃ink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikil⏎┃ink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikil⏎  - ink 1]]⏎  - [[wikilink 2]]⏎
          1:08  Links⏎[[wikili┃nk 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikili⏎┃nk 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikili⏎  - nk 1]]⏎  - [[wikilink 2]]⏎
          1:09  Links⏎[[wikilin┃k 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilin⏎┃k 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilin⏎  - k 1]]⏎  - [[wikilink 2]]⏎
          1:10  Links⏎[[wikilink┃ 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink⏎┃ 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink⏎  -  1]]⏎  - [[wikilink 2]]⏎
          1:11  Links⏎[[wikilink ┃1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink ⏎┃1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink ⏎  - 1]]⏎  - [[wikilink 2]]⏎
          1:12  Links⏎[[wikilink 1┃]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1⏎┃]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1⏎  - ]]⏎  - [[wikilink 2]]⏎
          1:13  Links⏎[[wikilink 1]┃]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1]⏎┃]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]⏎  - ]⏎  - [[wikilink 2]]⏎
          1:14  Links⏎[[wikilink 1]]┃⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎┃⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  -⏎  - [[wikilink 2]]⏎
          2:00  Links⏎[[wikilink 1]]⏎┃[[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎⏎┃[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  -⏎  - [[wikilink 2]]⏎
          2:01  Links⏎[[wikilink 1]]⏎[┃[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[⏎┃[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [⏎  - [wikilink 2]]⏎
          2:02  Links⏎[[wikilink 1]]⏎[[┃wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[⏎┃wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[⏎  - wikilink 2]]⏎
          2:03  Links⏎[[wikilink 1]]⏎[[w┃ikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[w⏎┃ikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[w⏎  - ikilink 2]]⏎
          2:04  Links⏎[[wikilink 1]]⏎[[wi┃kilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wi⏎┃kilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wi⏎  - kilink 2]]⏎
          2:05  Links⏎[[wikilink 1]]⏎[[wik┃ilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wik⏎┃ilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wik⏎  - ilink 2]]⏎
          2:06  Links⏎[[wikilink 1]]⏎[[wiki┃link 2]]  ->  Links⏎[[wikilink 1]]⏎[[wiki⏎┃link 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wiki⏎  - link 2]]⏎
          2:07  Links⏎[[wikilink 1]]⏎[[wikil┃ink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikil⏎┃ink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikil⏎  - ink 2]]⏎
          2:08  Links⏎[[wikilink 1]]⏎[[wikili┃nk 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikili⏎┃nk 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikili⏎  - nk 2]]⏎
          2:09  Links⏎[[wikilink 1]]⏎[[wikilin┃k 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilin⏎┃k 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilin⏎  - k 2]]⏎
          2:10  Links⏎[[wikilink 1]]⏎[[wikilink┃ 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink⏎┃ 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink⏎  -  2]]⏎
          2:11  Links⏎[[wikilink 1]]⏎[[wikilink ┃2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink ⏎┃2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink ⏎  - 2]]⏎
          2:12  Links⏎[[wikilink 1]]⏎[[wikilink 2┃]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2⏎┃]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2⏎  - ]]⏎
          2:13  Links⏎[[wikilink 1]]⏎[[wikilink 2]┃]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2]⏎┃]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]⏎  - ]⏎
          2:14  Links⏎[[wikilink 1]]⏎[[wikilink 2]]┃  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2]]⏎┃
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎  -⏎
          """
        `)
      }
    },
    FUZZ_TIMEOUT,
  )
})

describe('caret fuzz over a wikilink outline in hide mode', () => {
  it(
    'records Backspace at every caret position',
    async () => {
      const table = await fuzzKey(setupHideOutline, OUTLINE_LINES, '{Backspace}')
      if (isSafari()) {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: Links⏎⏎- [[wikilink 1]]⏎- [[wikilink 2]]⏎
          0:01  L┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  ┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - inks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:02  Li┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  L┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Lnks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:03  Lin┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Li┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Liks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:04  Link┃s⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Lin┃s⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Lins⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:05  Links┃⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Link┃⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Link⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:00  Links⏎┃[[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎┃[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎⏎  [[wikilink 1]]⏎⏎  - [[wikilink 2]]⏎
          1:01  Links⏎[┃[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎┃[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:02  Links⏎[[┃wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[┃wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:03  Links⏎[[w┃ikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[┃ikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[ikilink 1]]⏎  - [[wikilink 2]]⏎
          1:04  Links⏎[[wi┃kilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[w┃kilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wkilink 1]]⏎  - [[wikilink 2]]⏎
          1:05  Links⏎[[wik┃ilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wi┃ilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wiilink 1]]⏎  - [[wikilink 2]]⏎
          1:06  Links⏎[[wiki┃link 1]]⏎[[wikilink 2]]  ->  Links⏎[[wik┃link 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wiklink 1]]⏎  - [[wikilink 2]]⏎
          1:07  Links⏎[[wikil┃ink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wiki┃ink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikiink 1]]⏎  - [[wikilink 2]]⏎
          1:08  Links⏎[[wikili┃nk 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikil┃nk 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilnk 1]]⏎  - [[wikilink 2]]⏎
          1:09  Links⏎[[wikilin┃k 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikili┃k 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilik 1]]⏎  - [[wikilink 2]]⏎
          1:10  Links⏎[[wikilink┃ 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilin┃ 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilin 1]]⏎  - [[wikilink 2]]⏎
          1:11  Links⏎[[wikilink ┃1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink┃1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink1]]⏎  - [[wikilink 2]]⏎
          1:12  Links⏎[[wikilink 1┃]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink ┃]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink ]]⏎  - [[wikilink 2]]⏎
          1:13  Links⏎[[wikilink 1]┃]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1┃]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]⏎  - [[wikilink 2]]⏎
          1:14  Links⏎[[wikilink 1]]┃⏎[[wikilink 2]]  ->  Links⏎┃⏎[[wikilink 2]]
                md: - Links⏎  -⏎  - [[wikilink 2]]⏎
          2:00  Links⏎[[wikilink 1]]⏎┃[[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎┃[[wikilink 2]]
                md: - Links⏎⏎  - [[wikilink 1]]⏎⏎  [[wikilink 2]]⏎
          2:01  Links⏎[[wikilink 1]]⏎[┃[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎┃[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [wikilink 2]]⏎
          2:02  Links⏎[[wikilink 1]]⏎[[┃wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[┃wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [wikilink 2]]⏎
          2:03  Links⏎[[wikilink 1]]⏎[[w┃ikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[┃ikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[ikilink 2]]⏎
          2:04  Links⏎[[wikilink 1]]⏎[[wi┃kilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[w┃kilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wkilink 2]]⏎
          2:05  Links⏎[[wikilink 1]]⏎[[wik┃ilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wi┃ilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wiilink 2]]⏎
          2:06  Links⏎[[wikilink 1]]⏎[[wiki┃link 2]]  ->  Links⏎[[wikilink 1]]⏎[[wik┃link 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wiklink 2]]⏎
          2:07  Links⏎[[wikilink 1]]⏎[[wikil┃ink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wiki┃ink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikiink 2]]⏎
          2:08  Links⏎[[wikilink 1]]⏎[[wikili┃nk 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikil┃nk 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilnk 2]]⏎
          2:09  Links⏎[[wikilink 1]]⏎[[wikilin┃k 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikili┃k 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilik 2]]⏎
          2:10  Links⏎[[wikilink 1]]⏎[[wikilink┃ 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilin┃ 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilin 2]]⏎
          2:11  Links⏎[[wikilink 1]]⏎[[wikilink ┃2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink┃2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink2]]⏎
          2:12  Links⏎[[wikilink 1]]⏎[[wikilink 2┃]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink ┃]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink ]]⏎
          2:13  Links⏎[[wikilink 1]]⏎[[wikilink 2]┃]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2┃]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]⏎
          2:14  Links⏎[[wikilink 1]]⏎[[wikilink 2]]┃  ->  Links⏎[[wikilink 1]]⏎┃
                md: - Links⏎  - [[wikilink 1]]⏎  -⏎
          """
        `)
      } else if (isFirefox()) {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: Links⏎⏎- [[wikilink 1]]⏎- [[wikilink 2]]⏎
          0:01  L┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  ┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - inks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:02  Li┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  L┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Lnks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:03  Lin┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Li┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Liks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:04  Link┃s⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Lin┃s⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Lins⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:05  Links┃⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Link┃⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Link⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:00  Links⏎┃[[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎┃[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎⏎  [[wikilink 1]]⏎⏎  - [[wikilink 2]]⏎
          1:01  Links⏎[┃[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎┃[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:02  Links⏎[[┃wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[┃wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:03  Links⏎[[w┃ikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[┃ikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[ikilink 1]]⏎  - [[wikilink 2]]⏎
          1:04  Links⏎[[wi┃kilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[w┃kilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wkilink 1]]⏎  - [[wikilink 2]]⏎
          1:05  Links⏎[[wik┃ilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wi┃ilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wiilink 1]]⏎  - [[wikilink 2]]⏎
          1:06  Links⏎[[wiki┃link 1]]⏎[[wikilink 2]]  ->  Links⏎[[wik┃link 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wiklink 1]]⏎  - [[wikilink 2]]⏎
          1:07  Links⏎[[wikil┃ink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wiki┃ink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikiink 1]]⏎  - [[wikilink 2]]⏎
          1:08  Links⏎[[wikili┃nk 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikil┃nk 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilnk 1]]⏎  - [[wikilink 2]]⏎
          1:09  Links⏎[[wikilin┃k 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikili┃k 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilik 1]]⏎  - [[wikilink 2]]⏎
          1:10  Links⏎[[wikilink┃ 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilin┃ 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilin 1]]⏎  - [[wikilink 2]]⏎
          1:11  Links⏎[[wikilink ┃1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink┃1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink1]]⏎  - [[wikilink 2]]⏎
          1:12  Links⏎[[wikilink 1┃]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink ┃]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink ]]⏎  - [[wikilink 2]]⏎
          1:13  Links⏎[[wikilink 1]┃]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1┃]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]⏎  - [[wikilink 2]]⏎
          1:14  Links⏎[[wikilink 1]]┃⏎[[wikilink 2]]  ->  Links⏎┃⏎[[wikilink 2]]
                md: - Links⏎  -⏎  - [[wikilink 2]]⏎
          2:00  Links⏎[[wikilink 1]]⏎┃[[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎┃[[wikilink 2]]
                md: - Links⏎⏎  - [[wikilink 1]]⏎⏎  [[wikilink 2]]⏎
          2:01  Links⏎[[wikilink 1]]⏎[┃[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎┃[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [wikilink 2]]⏎
          2:02  Links⏎[[wikilink 1]]⏎[[┃wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[┃wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [wikilink 2]]⏎
          2:03  Links⏎[[wikilink 1]]⏎[[w┃ikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[┃ikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[ikilink 2]]⏎
          2:04  Links⏎[[wikilink 1]]⏎[[wi┃kilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[w┃kilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wkilink 2]]⏎
          2:05  Links⏎[[wikilink 1]]⏎[[wik┃ilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wi┃ilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wiilink 2]]⏎
          2:06  Links⏎[[wikilink 1]]⏎[[wiki┃link 2]]  ->  Links⏎[[wikilink 1]]⏎[[wik┃link 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wiklink 2]]⏎
          2:07  Links⏎[[wikilink 1]]⏎[[wikil┃ink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wiki┃ink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikiink 2]]⏎
          2:08  Links⏎[[wikilink 1]]⏎[[wikili┃nk 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikil┃nk 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilnk 2]]⏎
          2:09  Links⏎[[wikilink 1]]⏎[[wikilin┃k 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikili┃k 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilik 2]]⏎
          2:10  Links⏎[[wikilink 1]]⏎[[wikilink┃ 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilin┃ 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilin 2]]⏎
          2:11  Links⏎[[wikilink 1]]⏎[[wikilink ┃2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink┃2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink2]]⏎
          2:12  Links⏎[[wikilink 1]]⏎[[wikilink 2┃]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink ┃]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink ]]⏎
          2:13  Links⏎[[wikilink 1]]⏎[[wikilink 2]┃]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2┃]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]⏎
          2:14  Links⏎[[wikilink 1]]⏎[[wikilink 2]]┃  ->  Links⏎[[wikilink 1]]⏎┃
                md: - Links⏎  - [[wikilink 1]]⏎  -⏎
          """
        `)
      } else {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: Links⏎⏎- [[wikilink 1]]⏎- [[wikilink 2]]⏎
          0:01  L┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  ┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - inks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:02  Li┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  L┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Lnks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:03  Lin┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Li┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Liks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:04  Link┃s⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Lin┃s⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Lins⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:05  Links┃⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Link┃⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Link⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:00  Links⏎┃[[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎┃[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎⏎  [[wikilink 1]]⏎⏎  - [[wikilink 2]]⏎
          1:01  Links⏎[┃[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎┃[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:02  Links⏎[[┃wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[┃wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:03  Links⏎[[w┃ikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[┃ikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[ikilink 1]]⏎  - [[wikilink 2]]⏎
          1:04  Links⏎[[wi┃kilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[w┃kilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wkilink 1]]⏎  - [[wikilink 2]]⏎
          1:05  Links⏎[[wik┃ilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wi┃ilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wiilink 1]]⏎  - [[wikilink 2]]⏎
          1:06  Links⏎[[wiki┃link 1]]⏎[[wikilink 2]]  ->  Links⏎[[wik┃link 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wiklink 1]]⏎  - [[wikilink 2]]⏎
          1:07  Links⏎[[wikil┃ink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wiki┃ink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikiink 1]]⏎  - [[wikilink 2]]⏎
          1:08  Links⏎[[wikili┃nk 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikil┃nk 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilnk 1]]⏎  - [[wikilink 2]]⏎
          1:09  Links⏎[[wikilin┃k 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikili┃k 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilik 1]]⏎  - [[wikilink 2]]⏎
          1:10  Links⏎[[wikilink┃ 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilin┃ 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilin 1]]⏎  - [[wikilink 2]]⏎
          1:11  Links⏎[[wikilink ┃1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink┃1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink1]]⏎  - [[wikilink 2]]⏎
          1:12  Links⏎[[wikilink 1┃]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink ┃]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink ]]⏎  - [[wikilink 2]]⏎
          1:13  Links⏎[[wikilink 1]┃]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1┃]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]⏎  - [[wikilink 2]]⏎
          1:14  Links⏎[[wikilink 1]]┃⏎[[wikilink 2]]  ->  Links⏎┃⏎[[wikilink 2]]
                md: - Links⏎  -⏎  - [[wikilink 2]]⏎
          2:00  Links⏎[[wikilink 1]]⏎┃[[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎┃[[wikilink 2]]
                md: - Links⏎⏎  - [[wikilink 1]]⏎⏎  [[wikilink 2]]⏎
          2:01  Links⏎[[wikilink 1]]⏎[┃[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎┃[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [wikilink 2]]⏎
          2:02  Links⏎[[wikilink 1]]⏎[[┃wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[┃wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [wikilink 2]]⏎
          2:03  Links⏎[[wikilink 1]]⏎[[w┃ikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[┃ikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[ikilink 2]]⏎
          2:04  Links⏎[[wikilink 1]]⏎[[wi┃kilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[w┃kilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wkilink 2]]⏎
          2:05  Links⏎[[wikilink 1]]⏎[[wik┃ilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wi┃ilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wiilink 2]]⏎
          2:06  Links⏎[[wikilink 1]]⏎[[wiki┃link 2]]  ->  Links⏎[[wikilink 1]]⏎[[wik┃link 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wiklink 2]]⏎
          2:07  Links⏎[[wikilink 1]]⏎[[wikil┃ink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wiki┃ink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikiink 2]]⏎
          2:08  Links⏎[[wikilink 1]]⏎[[wikili┃nk 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikil┃nk 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilnk 2]]⏎
          2:09  Links⏎[[wikilink 1]]⏎[[wikilin┃k 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikili┃k 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilik 2]]⏎
          2:10  Links⏎[[wikilink 1]]⏎[[wikilink┃ 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilin┃ 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilin 2]]⏎
          2:11  Links⏎[[wikilink 1]]⏎[[wikilink ┃2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink┃2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink2]]⏎
          2:12  Links⏎[[wikilink 1]]⏎[[wikilink 2┃]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink ┃]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink ]]⏎
          2:13  Links⏎[[wikilink 1]]⏎[[wikilink 2]┃]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2┃]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]⏎
          2:14  Links⏎[[wikilink 1]]⏎[[wikilink 2]]┃  ->  Links⏎[[wikilink 1]]⏎┃
                md: - Links⏎  - [[wikilink 1]]⏎  -⏎
          """
        `)
      }
    },
    FUZZ_TIMEOUT,
  )

  it(
    'records Space at every caret position',
    async () => {
      const table = await fuzzKey(setupHideOutline, OUTLINE_LINES, ' ')
      if (isSafari()) {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]  ->   ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: -  Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:01  L┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  L ┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - L inks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:02  Li┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Li ┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Li nks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:03  Lin┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Lin ┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Lin ks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:04  Link┃s⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Link ┃s⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Link s⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:05  Links┃⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Links ┃⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links ⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:00  Links⏎┃[[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎ ┃[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  -  [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:01  Links⏎[┃[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[ ┃[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [ [wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:02  Links⏎[[┃wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[ ┃wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[ wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:03  Links⏎[[w┃ikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[w ┃ikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[w ikilink 1]]⏎  - [[wikilink 2]]⏎
          1:04  Links⏎[[wi┃kilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wi ┃kilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wi kilink 1]]⏎  - [[wikilink 2]]⏎
          1:05  Links⏎[[wik┃ilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wik ┃ilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wik ilink 1]]⏎  - [[wikilink 2]]⏎
          1:06  Links⏎[[wiki┃link 1]]⏎[[wikilink 2]]  ->  Links⏎[[wiki ┃link 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wiki link 1]]⏎  - [[wikilink 2]]⏎
          1:07  Links⏎[[wikil┃ink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikil ┃ink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikil ink 1]]⏎  - [[wikilink 2]]⏎
          1:08  Links⏎[[wikili┃nk 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikili ┃nk 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikili nk 1]]⏎  - [[wikilink 2]]⏎
          1:09  Links⏎[[wikilin┃k 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilin ┃k 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilin k 1]]⏎  - [[wikilink 2]]⏎
          1:10  Links⏎[[wikilink┃ 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink ┃ 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink  1]]⏎  - [[wikilink 2]]⏎
          1:11  Links⏎[[wikilink ┃1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink  ┃1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink  1]]⏎  - [[wikilink 2]]⏎
          1:12  Links⏎[[wikilink 1┃]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1 ┃]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1 ]]⏎  - [[wikilink 2]]⏎
          1:13  Links⏎[[wikilink 1]┃]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1] ┃]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1] ]⏎  - [[wikilink 2]]⏎
          1:14  Links⏎[[wikilink 1]]┃⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1]] ┃⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]] ⏎  - [[wikilink 2]]⏎
          2:00  Links⏎[[wikilink 1]]⏎┃[[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎ ┃[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  -  [[wikilink 2]]⏎
          2:01  Links⏎[[wikilink 1]]⏎[┃[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[ ┃[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [ [wikilink 2]]⏎
          2:02  Links⏎[[wikilink 1]]⏎[[┃wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[ ┃wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[ wikilink 2]]⏎
          2:03  Links⏎[[wikilink 1]]⏎[[w┃ikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[w ┃ikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[w ikilink 2]]⏎
          2:04  Links⏎[[wikilink 1]]⏎[[wi┃kilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wi ┃kilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wi kilink 2]]⏎
          2:05  Links⏎[[wikilink 1]]⏎[[wik┃ilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wik ┃ilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wik ilink 2]]⏎
          2:06  Links⏎[[wikilink 1]]⏎[[wiki┃link 2]]  ->  Links⏎[[wikilink 1]]⏎[[wiki ┃link 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wiki link 2]]⏎
          2:07  Links⏎[[wikilink 1]]⏎[[wikil┃ink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikil ┃ink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikil ink 2]]⏎
          2:08  Links⏎[[wikilink 1]]⏎[[wikili┃nk 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikili ┃nk 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikili nk 2]]⏎
          2:09  Links⏎[[wikilink 1]]⏎[[wikilin┃k 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilin ┃k 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilin k 2]]⏎
          2:10  Links⏎[[wikilink 1]]⏎[[wikilink┃ 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink ┃ 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink  2]]⏎
          2:11  Links⏎[[wikilink 1]]⏎[[wikilink ┃2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink  ┃2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink  2]]⏎
          2:12  Links⏎[[wikilink 1]]⏎[[wikilink 2┃]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2 ┃]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2 ]]⏎
          2:13  Links⏎[[wikilink 1]]⏎[[wikilink 2]┃]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2] ┃]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2] ]⏎
          2:14  Links⏎[[wikilink 1]]⏎[[wikilink 2]]┃  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2]] ┃
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          """
        `)
      } else if (isFirefox()) {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]  ->   ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: -  Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:01  L┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  L ┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - L inks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:02  Li┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Li ┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Li nks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:03  Lin┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Lin ┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Lin ks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:04  Link┃s⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Link ┃s⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Link s⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:05  Links┃⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Links ┃⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links ⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:00  Links⏎┃[[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎ ┃[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  -  [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:01  Links⏎[┃[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[ ┃[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [ [wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:02  Links⏎[[┃wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[ ┃wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[ wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:03  Links⏎[[w┃ikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[w ┃ikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[w ikilink 1]]⏎  - [[wikilink 2]]⏎
          1:04  Links⏎[[wi┃kilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wi ┃kilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wi kilink 1]]⏎  - [[wikilink 2]]⏎
          1:05  Links⏎[[wik┃ilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wik ┃ilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wik ilink 1]]⏎  - [[wikilink 2]]⏎
          1:06  Links⏎[[wiki┃link 1]]⏎[[wikilink 2]]  ->  Links⏎[[wiki ┃link 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wiki link 1]]⏎  - [[wikilink 2]]⏎
          1:07  Links⏎[[wikil┃ink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikil ┃ink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikil ink 1]]⏎  - [[wikilink 2]]⏎
          1:08  Links⏎[[wikili┃nk 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikili ┃nk 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikili nk 1]]⏎  - [[wikilink 2]]⏎
          1:09  Links⏎[[wikilin┃k 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilin ┃k 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilin k 1]]⏎  - [[wikilink 2]]⏎
          1:10  Links⏎[[wikilink┃ 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink ┃ 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink  1]]⏎  - [[wikilink 2]]⏎
          1:11  Links⏎[[wikilink ┃1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink  ┃1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink  1]]⏎  - [[wikilink 2]]⏎
          1:12  Links⏎[[wikilink 1┃]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1 ┃]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1 ]]⏎  - [[wikilink 2]]⏎
          1:13  Links⏎[[wikilink 1]┃]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1] ┃]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1] ]⏎  - [[wikilink 2]]⏎
          1:14  Links⏎[[wikilink 1]]┃⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1]] ┃⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]] ⏎  - [[wikilink 2]]⏎
          2:00  Links⏎[[wikilink 1]]⏎┃[[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎ ┃[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  -  [[wikilink 2]]⏎
          2:01  Links⏎[[wikilink 1]]⏎[┃[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[ ┃[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [ [wikilink 2]]⏎
          2:02  Links⏎[[wikilink 1]]⏎[[┃wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[ ┃wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[ wikilink 2]]⏎
          2:03  Links⏎[[wikilink 1]]⏎[[w┃ikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[w ┃ikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[w ikilink 2]]⏎
          2:04  Links⏎[[wikilink 1]]⏎[[wi┃kilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wi ┃kilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wi kilink 2]]⏎
          2:05  Links⏎[[wikilink 1]]⏎[[wik┃ilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wik ┃ilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wik ilink 2]]⏎
          2:06  Links⏎[[wikilink 1]]⏎[[wiki┃link 2]]  ->  Links⏎[[wikilink 1]]⏎[[wiki ┃link 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wiki link 2]]⏎
          2:07  Links⏎[[wikilink 1]]⏎[[wikil┃ink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikil ┃ink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikil ink 2]]⏎
          2:08  Links⏎[[wikilink 1]]⏎[[wikili┃nk 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikili ┃nk 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikili nk 2]]⏎
          2:09  Links⏎[[wikilink 1]]⏎[[wikilin┃k 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilin ┃k 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilin k 2]]⏎
          2:10  Links⏎[[wikilink 1]]⏎[[wikilink┃ 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink ┃ 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink  2]]⏎
          2:11  Links⏎[[wikilink 1]]⏎[[wikilink ┃2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink  ┃2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink  2]]⏎
          2:12  Links⏎[[wikilink 1]]⏎[[wikilink 2┃]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2 ┃]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2 ]]⏎
          2:13  Links⏎[[wikilink 1]]⏎[[wikilink 2]┃]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2] ┃]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2] ]⏎
          2:14  Links⏎[[wikilink 1]]⏎[[wikilink 2]]┃  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2]] ┃
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          """
        `)
      } else {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]  ->   ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: -  Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:01  L┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  L ┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - L inks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:02  Li┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Li ┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Li nks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:03  Lin┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Lin ┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Lin ks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:04  Link┃s⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Link ┃s⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Link s⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:05  Links┃⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Links ┃⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links ⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:00  Links⏎┃[[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎ ┃[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  -  [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:01  Links⏎[┃[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[ ┃[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [ [wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:02  Links⏎[[┃wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[ ┃wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[ wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:03  Links⏎[[w┃ikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[w ┃ikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[w ikilink 1]]⏎  - [[wikilink 2]]⏎
          1:04  Links⏎[[wi┃kilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wi ┃kilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wi kilink 1]]⏎  - [[wikilink 2]]⏎
          1:05  Links⏎[[wik┃ilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wik ┃ilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wik ilink 1]]⏎  - [[wikilink 2]]⏎
          1:06  Links⏎[[wiki┃link 1]]⏎[[wikilink 2]]  ->  Links⏎[[wiki ┃link 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wiki link 1]]⏎  - [[wikilink 2]]⏎
          1:07  Links⏎[[wikil┃ink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikil ┃ink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikil ink 1]]⏎  - [[wikilink 2]]⏎
          1:08  Links⏎[[wikili┃nk 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikili ┃nk 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikili nk 1]]⏎  - [[wikilink 2]]⏎
          1:09  Links⏎[[wikilin┃k 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilin ┃k 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilin k 1]]⏎  - [[wikilink 2]]⏎
          1:10  Links⏎[[wikilink┃ 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink ┃ 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink  1]]⏎  - [[wikilink 2]]⏎
          1:11  Links⏎[[wikilink ┃1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink  ┃1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink  1]]⏎  - [[wikilink 2]]⏎
          1:12  Links⏎[[wikilink 1┃]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1 ┃]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1 ]]⏎  - [[wikilink 2]]⏎
          1:13  Links⏎[[wikilink 1]┃]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1] ┃]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1] ]⏎  - [[wikilink 2]]⏎
          1:14  Links⏎[[wikilink 1]]┃⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1]] ┃⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]] ⏎  - [[wikilink 2]]⏎
          2:00  Links⏎[[wikilink 1]]⏎┃[[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎ ┃[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  -  [[wikilink 2]]⏎
          2:01  Links⏎[[wikilink 1]]⏎[┃[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[ ┃[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [ [wikilink 2]]⏎
          2:02  Links⏎[[wikilink 1]]⏎[[┃wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[ ┃wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[ wikilink 2]]⏎
          2:03  Links⏎[[wikilink 1]]⏎[[w┃ikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[w ┃ikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[w ikilink 2]]⏎
          2:04  Links⏎[[wikilink 1]]⏎[[wi┃kilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wi ┃kilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wi kilink 2]]⏎
          2:05  Links⏎[[wikilink 1]]⏎[[wik┃ilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wik ┃ilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wik ilink 2]]⏎
          2:06  Links⏎[[wikilink 1]]⏎[[wiki┃link 2]]  ->  Links⏎[[wikilink 1]]⏎[[wiki ┃link 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wiki link 2]]⏎
          2:07  Links⏎[[wikilink 1]]⏎[[wikil┃ink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikil ┃ink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikil ink 2]]⏎
          2:08  Links⏎[[wikilink 1]]⏎[[wikili┃nk 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikili ┃nk 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikili nk 2]]⏎
          2:09  Links⏎[[wikilink 1]]⏎[[wikilin┃k 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilin ┃k 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilin k 2]]⏎
          2:10  Links⏎[[wikilink 1]]⏎[[wikilink┃ 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink ┃ 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink  2]]⏎
          2:11  Links⏎[[wikilink 1]]⏎[[wikilink ┃2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink  ┃2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink  2]]⏎
          2:12  Links⏎[[wikilink 1]]⏎[[wikilink 2┃]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2 ┃]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2 ]]⏎
          2:13  Links⏎[[wikilink 1]]⏎[[wikilink 2]┃]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2] ┃]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2] ]⏎
          2:14  Links⏎[[wikilink 1]]⏎[[wikilink 2]]┃  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2]] ┃
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          """
        `)
      }
    },
    FUZZ_TIMEOUT,
  )

  it(
    'records Enter at every caret position',
    async () => {
      const table = await fuzzKey(setupHideOutline, OUTLINE_LINES, '{Enter}')
      if (isSafari()) {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  ⏎┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: -⏎- Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:01  L┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  L⏎┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - L⏎- inks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:02  Li┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Li⏎┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Li⏎- nks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:03  Lin┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Lin⏎┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Lin⏎- ks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:04  Link┃s⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Link⏎┃s⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Link⏎- s⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:05  Links┃⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎┃⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎-⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:00  Links⏎┃[[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎⏎┃[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  -⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:01  Links⏎[┃[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[⏎┃[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [⏎  - [wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:02  Links⏎[[┃wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[⏎┃wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[⏎  - wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:03  Links⏎[[w┃ikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[w⏎┃ikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[w⏎  - ikilink 1]]⏎  - [[wikilink 2]]⏎
          1:04  Links⏎[[wi┃kilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wi⏎┃kilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wi⏎  - kilink 1]]⏎  - [[wikilink 2]]⏎
          1:05  Links⏎[[wik┃ilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wik⏎┃ilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wik⏎  - ilink 1]]⏎  - [[wikilink 2]]⏎
          1:06  Links⏎[[wiki┃link 1]]⏎[[wikilink 2]]  ->  Links⏎[[wiki⏎┃link 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wiki⏎  - link 1]]⏎  - [[wikilink 2]]⏎
          1:07  Links⏎[[wikil┃ink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikil⏎┃ink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikil⏎  - ink 1]]⏎  - [[wikilink 2]]⏎
          1:08  Links⏎[[wikili┃nk 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikili⏎┃nk 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikili⏎  - nk 1]]⏎  - [[wikilink 2]]⏎
          1:09  Links⏎[[wikilin┃k 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilin⏎┃k 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilin⏎  - k 1]]⏎  - [[wikilink 2]]⏎
          1:10  Links⏎[[wikilink┃ 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink⏎┃ 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink⏎  -  1]]⏎  - [[wikilink 2]]⏎
          1:11  Links⏎[[wikilink ┃1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink ⏎┃1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink ⏎  - 1]]⏎  - [[wikilink 2]]⏎
          1:12  Links⏎[[wikilink 1┃]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1⏎┃]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1⏎  - ]]⏎  - [[wikilink 2]]⏎
          1:13  Links⏎[[wikilink 1]┃]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1]⏎┃]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]⏎  - ]⏎  - [[wikilink 2]]⏎
          1:14  Links⏎[[wikilink 1]]┃⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎┃⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  -⏎  - [[wikilink 2]]⏎
          2:00  Links⏎[[wikilink 1]]⏎┃[[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎⏎┃[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  -⏎  - [[wikilink 2]]⏎
          2:01  Links⏎[[wikilink 1]]⏎[┃[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[⏎┃[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [⏎  - [wikilink 2]]⏎
          2:02  Links⏎[[wikilink 1]]⏎[[┃wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[⏎┃wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[⏎  - wikilink 2]]⏎
          2:03  Links⏎[[wikilink 1]]⏎[[w┃ikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[w⏎┃ikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[w⏎  - ikilink 2]]⏎
          2:04  Links⏎[[wikilink 1]]⏎[[wi┃kilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wi⏎┃kilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wi⏎  - kilink 2]]⏎
          2:05  Links⏎[[wikilink 1]]⏎[[wik┃ilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wik⏎┃ilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wik⏎  - ilink 2]]⏎
          2:06  Links⏎[[wikilink 1]]⏎[[wiki┃link 2]]  ->  Links⏎[[wikilink 1]]⏎[[wiki⏎┃link 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wiki⏎  - link 2]]⏎
          2:07  Links⏎[[wikilink 1]]⏎[[wikil┃ink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikil⏎┃ink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikil⏎  - ink 2]]⏎
          2:08  Links⏎[[wikilink 1]]⏎[[wikili┃nk 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikili⏎┃nk 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikili⏎  - nk 2]]⏎
          2:09  Links⏎[[wikilink 1]]⏎[[wikilin┃k 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilin⏎┃k 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilin⏎  - k 2]]⏎
          2:10  Links⏎[[wikilink 1]]⏎[[wikilink┃ 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink⏎┃ 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink⏎  -  2]]⏎
          2:11  Links⏎[[wikilink 1]]⏎[[wikilink ┃2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink ⏎┃2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink ⏎  - 2]]⏎
          2:12  Links⏎[[wikilink 1]]⏎[[wikilink 2┃]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2⏎┃]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2⏎  - ]]⏎
          2:13  Links⏎[[wikilink 1]]⏎[[wikilink 2]┃]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2]⏎┃]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]⏎  - ]⏎
          2:14  Links⏎[[wikilink 1]]⏎[[wikilink 2]]┃  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2]]⏎┃
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎  -⏎
          """
        `)
      } else if (isFirefox()) {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  ⏎┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: -⏎- Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:01  L┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  L⏎┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - L⏎- inks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:02  Li┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Li⏎┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Li⏎- nks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:03  Lin┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Lin⏎┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Lin⏎- ks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:04  Link┃s⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Link⏎┃s⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Link⏎- s⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:05  Links┃⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎┃⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎-⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:00  Links⏎┃[[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎⏎┃[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  -⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:01  Links⏎[┃[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[⏎┃[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [⏎  - [wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:02  Links⏎[[┃wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[⏎┃wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[⏎  - wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:03  Links⏎[[w┃ikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[w⏎┃ikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[w⏎  - ikilink 1]]⏎  - [[wikilink 2]]⏎
          1:04  Links⏎[[wi┃kilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wi⏎┃kilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wi⏎  - kilink 1]]⏎  - [[wikilink 2]]⏎
          1:05  Links⏎[[wik┃ilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wik⏎┃ilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wik⏎  - ilink 1]]⏎  - [[wikilink 2]]⏎
          1:06  Links⏎[[wiki┃link 1]]⏎[[wikilink 2]]  ->  Links⏎[[wiki⏎┃link 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wiki⏎  - link 1]]⏎  - [[wikilink 2]]⏎
          1:07  Links⏎[[wikil┃ink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikil⏎┃ink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikil⏎  - ink 1]]⏎  - [[wikilink 2]]⏎
          1:08  Links⏎[[wikili┃nk 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikili⏎┃nk 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikili⏎  - nk 1]]⏎  - [[wikilink 2]]⏎
          1:09  Links⏎[[wikilin┃k 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilin⏎┃k 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilin⏎  - k 1]]⏎  - [[wikilink 2]]⏎
          1:10  Links⏎[[wikilink┃ 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink⏎┃ 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink⏎  -  1]]⏎  - [[wikilink 2]]⏎
          1:11  Links⏎[[wikilink ┃1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink ⏎┃1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink ⏎  - 1]]⏎  - [[wikilink 2]]⏎
          1:12  Links⏎[[wikilink 1┃]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1⏎┃]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1⏎  - ]]⏎  - [[wikilink 2]]⏎
          1:13  Links⏎[[wikilink 1]┃]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1]⏎┃]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]⏎  - ]⏎  - [[wikilink 2]]⏎
          1:14  Links⏎[[wikilink 1]]┃⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎┃⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  -⏎  - [[wikilink 2]]⏎
          2:00  Links⏎[[wikilink 1]]⏎┃[[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎⏎┃[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  -⏎  - [[wikilink 2]]⏎
          2:01  Links⏎[[wikilink 1]]⏎[┃[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[⏎┃[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [⏎  - [wikilink 2]]⏎
          2:02  Links⏎[[wikilink 1]]⏎[[┃wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[⏎┃wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[⏎  - wikilink 2]]⏎
          2:03  Links⏎[[wikilink 1]]⏎[[w┃ikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[w⏎┃ikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[w⏎  - ikilink 2]]⏎
          2:04  Links⏎[[wikilink 1]]⏎[[wi┃kilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wi⏎┃kilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wi⏎  - kilink 2]]⏎
          2:05  Links⏎[[wikilink 1]]⏎[[wik┃ilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wik⏎┃ilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wik⏎  - ilink 2]]⏎
          2:06  Links⏎[[wikilink 1]]⏎[[wiki┃link 2]]  ->  Links⏎[[wikilink 1]]⏎[[wiki⏎┃link 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wiki⏎  - link 2]]⏎
          2:07  Links⏎[[wikilink 1]]⏎[[wikil┃ink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikil⏎┃ink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikil⏎  - ink 2]]⏎
          2:08  Links⏎[[wikilink 1]]⏎[[wikili┃nk 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikili⏎┃nk 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikili⏎  - nk 2]]⏎
          2:09  Links⏎[[wikilink 1]]⏎[[wikilin┃k 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilin⏎┃k 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilin⏎  - k 2]]⏎
          2:10  Links⏎[[wikilink 1]]⏎[[wikilink┃ 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink⏎┃ 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink⏎  -  2]]⏎
          2:11  Links⏎[[wikilink 1]]⏎[[wikilink ┃2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink ⏎┃2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink ⏎  - 2]]⏎
          2:12  Links⏎[[wikilink 1]]⏎[[wikilink 2┃]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2⏎┃]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2⏎  - ]]⏎
          2:13  Links⏎[[wikilink 1]]⏎[[wikilink 2]┃]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2]⏎┃]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]⏎  - ]⏎
          2:14  Links⏎[[wikilink 1]]⏎[[wikilink 2]]┃  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2]]⏎┃
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎  -⏎
          """
        `)
      } else {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  ⏎┃Links⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: -⏎- Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:01  L┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  L⏎┃inks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - L⏎- inks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:02  Li┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Li⏎┃nks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Li⏎- nks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:03  Lin┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Lin⏎┃ks⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Lin⏎- ks⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:04  Link┃s⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Link⏎┃s⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Link⏎- s⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          0:05  Links┃⏎[[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎┃⏎[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎-⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:00  Links⏎┃[[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎⏎┃[[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  -⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:01  Links⏎[┃[wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[⏎┃[wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [⏎  - [wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:02  Links⏎[[┃wikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[⏎┃wikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[⏎  - wikilink 1]]⏎  - [[wikilink 2]]⏎
          1:03  Links⏎[[w┃ikilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[w⏎┃ikilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[w⏎  - ikilink 1]]⏎  - [[wikilink 2]]⏎
          1:04  Links⏎[[wi┃kilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wi⏎┃kilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wi⏎  - kilink 1]]⏎  - [[wikilink 2]]⏎
          1:05  Links⏎[[wik┃ilink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wik⏎┃ilink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wik⏎  - ilink 1]]⏎  - [[wikilink 2]]⏎
          1:06  Links⏎[[wiki┃link 1]]⏎[[wikilink 2]]  ->  Links⏎[[wiki⏎┃link 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wiki⏎  - link 1]]⏎  - [[wikilink 2]]⏎
          1:07  Links⏎[[wikil┃ink 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikil⏎┃ink 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikil⏎  - ink 1]]⏎  - [[wikilink 2]]⏎
          1:08  Links⏎[[wikili┃nk 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikili⏎┃nk 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikili⏎  - nk 1]]⏎  - [[wikilink 2]]⏎
          1:09  Links⏎[[wikilin┃k 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilin⏎┃k 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilin⏎  - k 1]]⏎  - [[wikilink 2]]⏎
          1:10  Links⏎[[wikilink┃ 1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink⏎┃ 1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink⏎  -  1]]⏎  - [[wikilink 2]]⏎
          1:11  Links⏎[[wikilink ┃1]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink ⏎┃1]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink ⏎  - 1]]⏎  - [[wikilink 2]]⏎
          1:12  Links⏎[[wikilink 1┃]]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1⏎┃]]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1⏎  - ]]⏎  - [[wikilink 2]]⏎
          1:13  Links⏎[[wikilink 1]┃]⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1]⏎┃]⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]⏎  - ]⏎  - [[wikilink 2]]⏎
          1:14  Links⏎[[wikilink 1]]┃⏎[[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎┃⏎[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  -⏎  - [[wikilink 2]]⏎
          2:00  Links⏎[[wikilink 1]]⏎┃[[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎⏎┃[[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  -⏎  - [[wikilink 2]]⏎
          2:01  Links⏎[[wikilink 1]]⏎[┃[wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[⏎┃[wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [⏎  - [wikilink 2]]⏎
          2:02  Links⏎[[wikilink 1]]⏎[[┃wikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[⏎┃wikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[⏎  - wikilink 2]]⏎
          2:03  Links⏎[[wikilink 1]]⏎[[w┃ikilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[w⏎┃ikilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[w⏎  - ikilink 2]]⏎
          2:04  Links⏎[[wikilink 1]]⏎[[wi┃kilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wi⏎┃kilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wi⏎  - kilink 2]]⏎
          2:05  Links⏎[[wikilink 1]]⏎[[wik┃ilink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wik⏎┃ilink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wik⏎  - ilink 2]]⏎
          2:06  Links⏎[[wikilink 1]]⏎[[wiki┃link 2]]  ->  Links⏎[[wikilink 1]]⏎[[wiki⏎┃link 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wiki⏎  - link 2]]⏎
          2:07  Links⏎[[wikilink 1]]⏎[[wikil┃ink 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikil⏎┃ink 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikil⏎  - ink 2]]⏎
          2:08  Links⏎[[wikilink 1]]⏎[[wikili┃nk 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikili⏎┃nk 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikili⏎  - nk 2]]⏎
          2:09  Links⏎[[wikilink 1]]⏎[[wikilin┃k 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilin⏎┃k 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilin⏎  - k 2]]⏎
          2:10  Links⏎[[wikilink 1]]⏎[[wikilink┃ 2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink⏎┃ 2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink⏎  -  2]]⏎
          2:11  Links⏎[[wikilink 1]]⏎[[wikilink ┃2]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink ⏎┃2]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink ⏎  - 2]]⏎
          2:12  Links⏎[[wikilink 1]]⏎[[wikilink 2┃]]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2⏎┃]]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2⏎  - ]]⏎
          2:13  Links⏎[[wikilink 1]]⏎[[wikilink 2]┃]  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2]⏎┃]
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]⏎  - ]⏎
          2:14  Links⏎[[wikilink 1]]⏎[[wikilink 2]]┃  ->  Links⏎[[wikilink 1]]⏎[[wikilink 2]]⏎┃
                md: - Links⏎  - [[wikilink 1]]⏎  - [[wikilink 2]]⏎  -⏎
          """
        `)
      }
    },
    FUZZ_TIMEOUT,
  )
})

// A wikilink surrounded by plain text: the caret reaches the unit from both
// sides through ordinary text.
const INLINE_LINES = ['see [[Note]] here']

describe('caret fuzz over a wikilink inside a paragraph in focus mode', () => {
  it(
    'records Backspace at every caret position',
    async () => {
      const table = await fuzzKey(setupFocusParagraphs, INLINE_LINES, '{Backspace}')
      if (isSafari()) {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃see [[Note]] here  ->  ┃see [[Note]] here
                md: see [[Note]] here⏎
          0:01  s┃ee [[Note]] here  ->  ┃ee [[Note]] here
                md: ee [[Note]] here⏎
          0:02  se┃e [[Note]] here  ->  s┃e [[Note]] here
                md: se [[Note]] here⏎
          0:03  see┃ [[Note]] here  ->  se┃ [[Note]] here
                md: se [[Note]] here⏎
          0:04  see ┃[[Note]] here  ->  see┃[[Note]] here
                md: see[[Note]] here⏎
          0:05  see [┃[Note]] here  ->  see ┃[Note]] here
                md: see [Note]] here⏎
          0:06  see [[┃Note]] here  ->  see [┃Note]] here
                md: see [Note]] here⏎
          0:07  see [[N┃ote]] here  ->  see [[┃ote]] here
                md: see [[ote]] here⏎
          0:08  see [[No┃te]] here  ->  see [[N┃te]] here
                md: see [[Nte]] here⏎
          0:09  see [[Not┃e]] here  ->  see [[No┃e]] here
                md: see [[Noe]] here⏎
          0:10  see [[Note┃]] here  ->  see [[Not┃]] here
                md: see [[Not]] here⏎
          0:11  see [[Note]┃] here  ->  see [[Note┃] here
                md: see [[Note] here⏎
          0:12  see [[Note]]┃ here  ->  see ┃ here
                md: see  here⏎
          0:13  see [[Note]] ┃here  ->  see [[Note]]┃here
                md: see [[Note]]here⏎
          0:14  see [[Note]] h┃ere  ->  see [[Note]] ┃ere
                md: see [[Note]] ere⏎
          0:15  see [[Note]] he┃re  ->  see [[Note]] h┃re
                md: see [[Note]] hre⏎
          0:16  see [[Note]] her┃e  ->  see [[Note]] he┃e
                md: see [[Note]] hee⏎
          0:17  see [[Note]] here┃  ->  see [[Note]] her┃
                md: see [[Note]] her⏎
          """
        `)
      } else if (isFirefox()) {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃see [[Note]] here  ->  ┃see [[Note]] here
                md: see [[Note]] here⏎
          0:01  s┃ee [[Note]] here  ->  ┃ee [[Note]] here
                md: ee [[Note]] here⏎
          0:02  se┃e [[Note]] here  ->  s┃e [[Note]] here
                md: se [[Note]] here⏎
          0:03  see┃ [[Note]] here  ->  se┃ [[Note]] here
                md: se [[Note]] here⏎
          0:04  see ┃[[Note]] here  ->  see┃[[Note]] here
                md: see[[Note]] here⏎
          0:05  see [┃[Note]] here  ->  see ┃[Note]] here
                md: see [Note]] here⏎
          0:06  see [[┃Note]] here  ->  see [┃Note]] here
                md: see [Note]] here⏎
          0:07  see [[N┃ote]] here  ->  see [[┃ote]] here
                md: see [[ote]] here⏎
          0:08  see [[No┃te]] here  ->  see [[N┃te]] here
                md: see [[Nte]] here⏎
          0:09  see [[Not┃e]] here  ->  see [[No┃e]] here
                md: see [[Noe]] here⏎
          0:10  see [[Note┃]] here  ->  see [[Not┃]] here
                md: see [[Not]] here⏎
          0:11  see [[Note]┃] here  ->  see [[Note┃] here
                md: see [[Note] here⏎
          0:12  see [[Note]]┃ here  ->  see ┃ here
                md: see  here⏎
          0:13  see [[Note]] ┃here  ->  see [[Note]]┃here
                md: see [[Note]]here⏎
          0:14  see [[Note]] h┃ere  ->  see [[Note]] ┃ere
                md: see [[Note]] ere⏎
          0:15  see [[Note]] he┃re  ->  see [[Note]] h┃re
                md: see [[Note]] hre⏎
          0:16  see [[Note]] her┃e  ->  see [[Note]] he┃e
                md: see [[Note]] hee⏎
          0:17  see [[Note]] here┃  ->  see [[Note]] her┃
                md: see [[Note]] her⏎
          """
        `)
      } else {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃see [[Note]] here  ->  ┃see [[Note]] here
                md: see [[Note]] here⏎
          0:01  s┃ee [[Note]] here  ->  ┃ee [[Note]] here
                md: ee [[Note]] here⏎
          0:02  se┃e [[Note]] here  ->  s┃e [[Note]] here
                md: se [[Note]] here⏎
          0:03  see┃ [[Note]] here  ->  se┃ [[Note]] here
                md: se [[Note]] here⏎
          0:04  see ┃[[Note]] here  ->  see┃[[Note]] here
                md: see[[Note]] here⏎
          0:05  see [┃[Note]] here  ->  see ┃[Note]] here
                md: see [Note]] here⏎
          0:06  see [[┃Note]] here  ->  see [┃Note]] here
                md: see [Note]] here⏎
          0:07  see [[N┃ote]] here  ->  see [[┃ote]] here
                md: see [[ote]] here⏎
          0:08  see [[No┃te]] here  ->  see [[N┃te]] here
                md: see [[Nte]] here⏎
          0:09  see [[Not┃e]] here  ->  see [[No┃e]] here
                md: see [[Noe]] here⏎
          0:10  see [[Note┃]] here  ->  see [[Not┃]] here
                md: see [[Not]] here⏎
          0:11  see [[Note]┃] here  ->  see [[Note┃] here
                md: see [[Note] here⏎
          0:12  see [[Note]]┃ here  ->  see ┃ here
                md: see  here⏎
          0:13  see [[Note]] ┃here  ->  see [[Note]]┃here
                md: see [[Note]]here⏎
          0:14  see [[Note]] h┃ere  ->  see [[Note]] ┃ere
                md: see [[Note]] ere⏎
          0:15  see [[Note]] he┃re  ->  see [[Note]] h┃re
                md: see [[Note]] hre⏎
          0:16  see [[Note]] her┃e  ->  see [[Note]] he┃e
                md: see [[Note]] hee⏎
          0:17  see [[Note]] here┃  ->  see [[Note]] her┃
                md: see [[Note]] her⏎
          """
        `)
      }
    },
    FUZZ_TIMEOUT,
  )

  it(
    'records Space at every caret position',
    async () => {
      const table = await fuzzKey(setupFocusParagraphs, INLINE_LINES, ' ')
      if (isSafari()) {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃see [[Note]] here  ->   ┃see [[Note]] here
                md:  see [[Note]] here⏎
          0:01  s┃ee [[Note]] here  ->  s ┃ee [[Note]] here
                md: s ee [[Note]] here⏎
          0:02  se┃e [[Note]] here  ->  se ┃e [[Note]] here
                md: se e [[Note]] here⏎
          0:03  see┃ [[Note]] here  ->  see ┃ [[Note]] here
                md: see  [[Note]] here⏎
          0:04  see ┃[[Note]] here  ->  see  ┃[[Note]] here
                md: see  [[Note]] here⏎
          0:05  see [┃[Note]] here  ->  see [ ┃[Note]] here
                md: see [ [Note]] here⏎
          0:06  see [[┃Note]] here  ->  see [[ ┃Note]] here
                md: see [[ Note]] here⏎
          0:07  see [[N┃ote]] here  ->  see [[N ┃ote]] here
                md: see [[N ote]] here⏎
          0:08  see [[No┃te]] here  ->  see [[No ┃te]] here
                md: see [[No te]] here⏎
          0:09  see [[Not┃e]] here  ->  see [[Not ┃e]] here
                md: see [[Not e]] here⏎
          0:10  see [[Note┃]] here  ->  see [[Note ┃]] here
                md: see [[Note ]] here⏎
          0:11  see [[Note]┃] here  ->  see [[Note] ┃] here
                md: see [[Note] ] here⏎
          0:12  see [[Note]]┃ here  ->  see [[Note]] ┃ here
                md: see [[Note]]  here⏎
          0:13  see [[Note]] ┃here  ->  see [[Note]]  ┃here
                md: see [[Note]]  here⏎
          0:14  see [[Note]] h┃ere  ->  see [[Note]] h ┃ere
                md: see [[Note]] h ere⏎
          0:15  see [[Note]] he┃re  ->  see [[Note]] he ┃re
                md: see [[Note]] he re⏎
          0:16  see [[Note]] her┃e  ->  see [[Note]] her ┃e
                md: see [[Note]] her e⏎
          0:17  see [[Note]] here┃  ->  see [[Note]] here ┃
                md: see [[Note]] here⏎
          """
        `)
      } else if (isFirefox()) {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃see [[Note]] here  ->   ┃see [[Note]] here
                md:  see [[Note]] here⏎
          0:01  s┃ee [[Note]] here  ->  s ┃ee [[Note]] here
                md: s ee [[Note]] here⏎
          0:02  se┃e [[Note]] here  ->  se ┃e [[Note]] here
                md: se e [[Note]] here⏎
          0:03  see┃ [[Note]] here  ->  see ┃ [[Note]] here
                md: see  [[Note]] here⏎
          0:04  see ┃[[Note]] here  ->  see  ┃[[Note]] here
                md: see  [[Note]] here⏎
          0:05  see [┃[Note]] here  ->  see [ ┃[Note]] here
                md: see [ [Note]] here⏎
          0:06  see [[┃Note]] here  ->  see [[ ┃Note]] here
                md: see [[ Note]] here⏎
          0:07  see [[N┃ote]] here  ->  see [[N ┃ote]] here
                md: see [[N ote]] here⏎
          0:08  see [[No┃te]] here  ->  see [[No ┃te]] here
                md: see [[No te]] here⏎
          0:09  see [[Not┃e]] here  ->  see [[Not ┃e]] here
                md: see [[Not e]] here⏎
          0:10  see [[Note┃]] here  ->  see [[Note ┃]] here
                md: see [[Note ]] here⏎
          0:11  see [[Note]┃] here  ->  see [[Note] ┃] here
                md: see [[Note] ] here⏎
          0:12  see [[Note]]┃ here  ->  see [[Note]] ┃ here
                md: see [[Note]]  here⏎
          0:13  see [[Note]] ┃here  ->  see [[Note]]  ┃here
                md: see [[Note]]  here⏎
          0:14  see [[Note]] h┃ere  ->  see [[Note]] h ┃ere
                md: see [[Note]] h ere⏎
          0:15  see [[Note]] he┃re  ->  see [[Note]] he ┃re
                md: see [[Note]] he re⏎
          0:16  see [[Note]] her┃e  ->  see [[Note]] her ┃e
                md: see [[Note]] her e⏎
          0:17  see [[Note]] here┃  ->  see [[Note]] here ┃
                md: see [[Note]] here⏎
          """
        `)
      } else {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃see [[Note]] here  ->   ┃see [[Note]] here
                md:  see [[Note]] here⏎
          0:01  s┃ee [[Note]] here  ->  s ┃ee [[Note]] here
                md: s ee [[Note]] here⏎
          0:02  se┃e [[Note]] here  ->  se ┃e [[Note]] here
                md: se e [[Note]] here⏎
          0:03  see┃ [[Note]] here  ->  see ┃ [[Note]] here
                md: see  [[Note]] here⏎
          0:04  see ┃[[Note]] here  ->  see  ┃[[Note]] here
                md: see  [[Note]] here⏎
          0:05  see [┃[Note]] here  ->  see [ ┃[Note]] here
                md: see [ [Note]] here⏎
          0:06  see [[┃Note]] here  ->  see [[ ┃Note]] here
                md: see [[ Note]] here⏎
          0:07  see [[N┃ote]] here  ->  see [[N ┃ote]] here
                md: see [[N ote]] here⏎
          0:08  see [[No┃te]] here  ->  see [[No ┃te]] here
                md: see [[No te]] here⏎
          0:09  see [[Not┃e]] here  ->  see [[Not ┃e]] here
                md: see [[Not e]] here⏎
          0:10  see [[Note┃]] here  ->  see [[Note ┃]] here
                md: see [[Note ]] here⏎
          0:11  see [[Note]┃] here  ->  see [[Note] ┃] here
                md: see [[Note] ] here⏎
          0:12  see [[Note]]┃ here  ->  see [[Note]] ┃ here
                md: see [[Note]]  here⏎
          0:13  see [[Note]] ┃here  ->  see [[Note]]  ┃here
                md: see [[Note]]  here⏎
          0:14  see [[Note]] h┃ere  ->  see [[Note]] h ┃ere
                md: see [[Note]] h ere⏎
          0:15  see [[Note]] he┃re  ->  see [[Note]] he ┃re
                md: see [[Note]] he re⏎
          0:16  see [[Note]] her┃e  ->  see [[Note]] her ┃e
                md: see [[Note]] her e⏎
          0:17  see [[Note]] here┃  ->  see [[Note]] here ┃
                md: see [[Note]] here⏎
          """
        `)
      }
    },
    FUZZ_TIMEOUT,
  )

  it(
    'records Enter at every caret position',
    async () => {
      const table = await fuzzKey(setupFocusParagraphs, INLINE_LINES, '{Enter}')
      if (isSafari()) {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃see [[Note]] here  ->  ⏎┃see [[Note]] here
                md: see [[Note]] here⏎
          0:01  s┃ee [[Note]] here  ->  s⏎┃ee [[Note]] here
                md: s⏎⏎ee [[Note]] here⏎
          0:02  se┃e [[Note]] here  ->  se⏎┃e [[Note]] here
                md: se⏎⏎e [[Note]] here⏎
          0:03  see┃ [[Note]] here  ->  see⏎┃ [[Note]] here
                md: see⏎⏎ [[Note]] here⏎
          0:04  see ┃[[Note]] here  ->  see ⏎┃[[Note]] here
                md: see ⏎⏎[[Note]] here⏎
          0:05  see [┃[Note]] here  ->  see [⏎┃[Note]] here
                md: see [⏎⏎[Note]] here⏎
          0:06  see [[┃Note]] here  ->  see [[⏎┃Note]] here
                md: see [[⏎⏎Note]] here⏎
          0:07  see [[N┃ote]] here  ->  see [[N⏎┃ote]] here
                md: see [[N⏎⏎ote]] here⏎
          0:08  see [[No┃te]] here  ->  see [[No⏎┃te]] here
                md: see [[No⏎⏎te]] here⏎
          0:09  see [[Not┃e]] here  ->  see [[Not⏎┃e]] here
                md: see [[Not⏎⏎e]] here⏎
          0:10  see [[Note┃]] here  ->  see [[Note⏎┃]] here
                md: see [[Note⏎⏎]] here⏎
          0:11  see [[Note]┃] here  ->  see [[Note]⏎┃] here
                md: see [[Note]⏎⏎] here⏎
          0:12  see [[Note]]┃ here  ->  see [[Note]]⏎┃ here
                md: see [[Note]]⏎⏎ here⏎
          0:13  see [[Note]] ┃here  ->  see [[Note]] ⏎┃here
                md: see [[Note]] ⏎⏎here⏎
          0:14  see [[Note]] h┃ere  ->  see [[Note]] h⏎┃ere
                md: see [[Note]] h⏎⏎ere⏎
          0:15  see [[Note]] he┃re  ->  see [[Note]] he⏎┃re
                md: see [[Note]] he⏎⏎re⏎
          0:16  see [[Note]] her┃e  ->  see [[Note]] her⏎┃e
                md: see [[Note]] her⏎⏎e⏎
          0:17  see [[Note]] here┃  ->  see [[Note]] here⏎┃
                md: see [[Note]] here⏎
          """
        `)
      } else if (isFirefox()) {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃see [[Note]] here  ->  ⏎┃see [[Note]] here
                md: see [[Note]] here⏎
          0:01  s┃ee [[Note]] here  ->  s⏎┃ee [[Note]] here
                md: s⏎⏎ee [[Note]] here⏎
          0:02  se┃e [[Note]] here  ->  se⏎┃e [[Note]] here
                md: se⏎⏎e [[Note]] here⏎
          0:03  see┃ [[Note]] here  ->  see⏎┃ [[Note]] here
                md: see⏎⏎ [[Note]] here⏎
          0:04  see ┃[[Note]] here  ->  see ⏎┃[[Note]] here
                md: see ⏎⏎[[Note]] here⏎
          0:05  see [┃[Note]] here  ->  see [⏎┃[Note]] here
                md: see [⏎⏎[Note]] here⏎
          0:06  see [[┃Note]] here  ->  see [[⏎┃Note]] here
                md: see [[⏎⏎Note]] here⏎
          0:07  see [[N┃ote]] here  ->  see [[N⏎┃ote]] here
                md: see [[N⏎⏎ote]] here⏎
          0:08  see [[No┃te]] here  ->  see [[No⏎┃te]] here
                md: see [[No⏎⏎te]] here⏎
          0:09  see [[Not┃e]] here  ->  see [[Not⏎┃e]] here
                md: see [[Not⏎⏎e]] here⏎
          0:10  see [[Note┃]] here  ->  see [[Note⏎┃]] here
                md: see [[Note⏎⏎]] here⏎
          0:11  see [[Note]┃] here  ->  see [[Note]⏎┃] here
                md: see [[Note]⏎⏎] here⏎
          0:12  see [[Note]]┃ here  ->  see [[Note]]⏎┃ here
                md: see [[Note]]⏎⏎ here⏎
          0:13  see [[Note]] ┃here  ->  see [[Note]] ⏎┃here
                md: see [[Note]] ⏎⏎here⏎
          0:14  see [[Note]] h┃ere  ->  see [[Note]] h⏎┃ere
                md: see [[Note]] h⏎⏎ere⏎
          0:15  see [[Note]] he┃re  ->  see [[Note]] he⏎┃re
                md: see [[Note]] he⏎⏎re⏎
          0:16  see [[Note]] her┃e  ->  see [[Note]] her⏎┃e
                md: see [[Note]] her⏎⏎e⏎
          0:17  see [[Note]] here┃  ->  see [[Note]] here⏎┃
                md: see [[Note]] here⏎
          """
        `)
      } else {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃see [[Note]] here  ->  ⏎┃see [[Note]] here
                md: see [[Note]] here⏎
          0:01  s┃ee [[Note]] here  ->  s⏎┃ee [[Note]] here
                md: s⏎⏎ee [[Note]] here⏎
          0:02  se┃e [[Note]] here  ->  se⏎┃e [[Note]] here
                md: se⏎⏎e [[Note]] here⏎
          0:03  see┃ [[Note]] here  ->  see⏎┃ [[Note]] here
                md: see⏎⏎ [[Note]] here⏎
          0:04  see ┃[[Note]] here  ->  see ⏎┃[[Note]] here
                md: see ⏎⏎[[Note]] here⏎
          0:05  see [┃[Note]] here  ->  see [⏎┃[Note]] here
                md: see [⏎⏎[Note]] here⏎
          0:06  see [[┃Note]] here  ->  see [[⏎┃Note]] here
                md: see [[⏎⏎Note]] here⏎
          0:07  see [[N┃ote]] here  ->  see [[N⏎┃ote]] here
                md: see [[N⏎⏎ote]] here⏎
          0:08  see [[No┃te]] here  ->  see [[No⏎┃te]] here
                md: see [[No⏎⏎te]] here⏎
          0:09  see [[Not┃e]] here  ->  see [[Not⏎┃e]] here
                md: see [[Not⏎⏎e]] here⏎
          0:10  see [[Note┃]] here  ->  see [[Note⏎┃]] here
                md: see [[Note⏎⏎]] here⏎
          0:11  see [[Note]┃] here  ->  see [[Note]⏎┃] here
                md: see [[Note]⏎⏎] here⏎
          0:12  see [[Note]]┃ here  ->  see [[Note]]⏎┃ here
                md: see [[Note]]⏎⏎ here⏎
          0:13  see [[Note]] ┃here  ->  see [[Note]] ⏎┃here
                md: see [[Note]] ⏎⏎here⏎
          0:14  see [[Note]] h┃ere  ->  see [[Note]] h⏎┃ere
                md: see [[Note]] h⏎⏎ere⏎
          0:15  see [[Note]] he┃re  ->  see [[Note]] he⏎┃re
                md: see [[Note]] he⏎⏎re⏎
          0:16  see [[Note]] her┃e  ->  see [[Note]] her⏎┃e
                md: see [[Note]] her⏎⏎e⏎
          0:17  see [[Note]] here┃  ->  see [[Note]] here⏎┃
                md: see [[Note]] here⏎
          """
        `)
      }
    },
    FUZZ_TIMEOUT,
  )
})

// Two wikilinks with nothing between them: the boundary where atom navigation
// resolves the unit in the wrong direction.
const ADJACENT_LINES = ['[[Aaa]][[Bbb]]']

describe('caret fuzz over two adjacent wikilinks in focus mode', () => {
  it(
    'records Backspace at every caret position',
    async () => {
      const table = await fuzzKey(setupFocusParagraphs, ADJACENT_LINES, '{Backspace}')
      if (isSafari()) {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃[[Aaa]][[Bbb]]  ->  ┃[[Aaa]][[Bbb]]
                md: [[Aaa]][[Bbb]]⏎
          0:01  [┃[Aaa]][[Bbb]]  ->  ┃[Aaa]][[Bbb]]
                md: [Aaa]][[Bbb]]⏎
          0:02  [[┃Aaa]][[Bbb]]  ->  [┃Aaa]][[Bbb]]
                md: [Aaa]][[Bbb]]⏎
          0:03  [[A┃aa]][[Bbb]]  ->  [[┃aa]][[Bbb]]
                md: [[aa]][[Bbb]]⏎
          0:04  [[Aa┃a]][[Bbb]]  ->  [[A┃a]][[Bbb]]
                md: [[Aa]][[Bbb]]⏎
          0:05  [[Aaa┃]][[Bbb]]  ->  [[Aa┃]][[Bbb]]
                md: [[Aa]][[Bbb]]⏎
          0:06  [[Aaa]┃][[Bbb]]  ->  [[Aaa┃][[Bbb]]
                md: [[Aaa][[Bbb]]⏎
          0:07  [[Aaa]]┃[[Bbb]]  ->  ┃[[Bbb]]
                md: [[Bbb]]⏎
          0:08  [[Aaa]][┃[Bbb]]  ->  [[Aaa]]┃[Bbb]]
                md: [[Aaa]][Bbb]]⏎
          0:09  [[Aaa]][[┃Bbb]]  ->  [[Aaa]][┃Bbb]]
                md: [[Aaa]][Bbb]]⏎
          0:10  [[Aaa]][[B┃bb]]  ->  [[Aaa]][[┃bb]]
                md: [[Aaa]][[bb]]⏎
          0:11  [[Aaa]][[Bb┃b]]  ->  [[Aaa]][[B┃b]]
                md: [[Aaa]][[Bb]]⏎
          0:12  [[Aaa]][[Bbb┃]]  ->  [[Aaa]][[Bb┃]]
                md: [[Aaa]][[Bb]]⏎
          0:13  [[Aaa]][[Bbb]┃]  ->  [[Aaa]][[Bbb┃]
                md: [[Aaa]][[Bbb]⏎
          0:14  [[Aaa]][[Bbb]]┃  ->  [[Aaa]]┃
                md: [[Aaa]]⏎
          """
        `)
      } else if (isFirefox()) {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃[[Aaa]][[Bbb]]  ->  ┃[[Aaa]][[Bbb]]
                md: [[Aaa]][[Bbb]]⏎
          0:01  [┃[Aaa]][[Bbb]]  ->  ┃[Aaa]][[Bbb]]
                md: [Aaa]][[Bbb]]⏎
          0:02  [[┃Aaa]][[Bbb]]  ->  [┃Aaa]][[Bbb]]
                md: [Aaa]][[Bbb]]⏎
          0:03  [[A┃aa]][[Bbb]]  ->  [[┃aa]][[Bbb]]
                md: [[aa]][[Bbb]]⏎
          0:04  [[Aa┃a]][[Bbb]]  ->  [[A┃a]][[Bbb]]
                md: [[Aa]][[Bbb]]⏎
          0:05  [[Aaa┃]][[Bbb]]  ->  [[Aa┃]][[Bbb]]
                md: [[Aa]][[Bbb]]⏎
          0:06  [[Aaa]┃][[Bbb]]  ->  [[Aaa┃][[Bbb]]
                md: [[Aaa][[Bbb]]⏎
          0:07  [[Aaa]]┃[[Bbb]]  ->  ┃[[Bbb]]
                md: [[Bbb]]⏎
          0:08  [[Aaa]][┃[Bbb]]  ->  [[Aaa]]┃[Bbb]]
                md: [[Aaa]][Bbb]]⏎
          0:09  [[Aaa]][[┃Bbb]]  ->  [[Aaa]][┃Bbb]]
                md: [[Aaa]][Bbb]]⏎
          0:10  [[Aaa]][[B┃bb]]  ->  [[Aaa]][[┃bb]]
                md: [[Aaa]][[bb]]⏎
          0:11  [[Aaa]][[Bb┃b]]  ->  [[Aaa]][[B┃b]]
                md: [[Aaa]][[Bb]]⏎
          0:12  [[Aaa]][[Bbb┃]]  ->  [[Aaa]][[Bb┃]]
                md: [[Aaa]][[Bb]]⏎
          0:13  [[Aaa]][[Bbb]┃]  ->  [[Aaa]][[Bbb┃]
                md: [[Aaa]][[Bbb]⏎
          0:14  [[Aaa]][[Bbb]]┃  ->  [[Aaa]]┃
                md: [[Aaa]]⏎
          """
        `)
      } else {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃[[Aaa]][[Bbb]]  ->  ┃[[Aaa]][[Bbb]]
                md: [[Aaa]][[Bbb]]⏎
          0:01  [┃[Aaa]][[Bbb]]  ->  ┃[Aaa]][[Bbb]]
                md: [Aaa]][[Bbb]]⏎
          0:02  [[┃Aaa]][[Bbb]]  ->  [┃Aaa]][[Bbb]]
                md: [Aaa]][[Bbb]]⏎
          0:03  [[A┃aa]][[Bbb]]  ->  [[┃aa]][[Bbb]]
                md: [[aa]][[Bbb]]⏎
          0:04  [[Aa┃a]][[Bbb]]  ->  [[A┃a]][[Bbb]]
                md: [[Aa]][[Bbb]]⏎
          0:05  [[Aaa┃]][[Bbb]]  ->  [[Aa┃]][[Bbb]]
                md: [[Aa]][[Bbb]]⏎
          0:06  [[Aaa]┃][[Bbb]]  ->  [[Aaa┃][[Bbb]]
                md: [[Aaa][[Bbb]]⏎
          0:07  [[Aaa]]┃[[Bbb]]  ->  ┃[[Bbb]]
                md: [[Bbb]]⏎
          0:08  [[Aaa]][┃[Bbb]]  ->  [[Aaa]]┃[Bbb]]
                md: [[Aaa]][Bbb]]⏎
          0:09  [[Aaa]][[┃Bbb]]  ->  [[Aaa]][┃Bbb]]
                md: [[Aaa]][Bbb]]⏎
          0:10  [[Aaa]][[B┃bb]]  ->  [[Aaa]][[┃bb]]
                md: [[Aaa]][[bb]]⏎
          0:11  [[Aaa]][[Bb┃b]]  ->  [[Aaa]][[B┃b]]
                md: [[Aaa]][[Bb]]⏎
          0:12  [[Aaa]][[Bbb┃]]  ->  [[Aaa]][[Bb┃]]
                md: [[Aaa]][[Bb]]⏎
          0:13  [[Aaa]][[Bbb]┃]  ->  [[Aaa]][[Bbb┃]
                md: [[Aaa]][[Bbb]⏎
          0:14  [[Aaa]][[Bbb]]┃  ->  [[Aaa]]┃
                md: [[Aaa]]⏎
          """
        `)
      }
    },
    FUZZ_TIMEOUT,
  )

  it(
    'records Space at every caret position',
    async () => {
      const table = await fuzzKey(setupFocusParagraphs, ADJACENT_LINES, ' ')
      if (isSafari()) {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃[[Aaa]][[Bbb]]  ->   ┃[[Aaa]][[Bbb]]
                md:  [[Aaa]][[Bbb]]⏎
          0:01  [┃[Aaa]][[Bbb]]  ->  [ ┃[Aaa]][[Bbb]]
                md: [ [Aaa]][[Bbb]]⏎
          0:02  [[┃Aaa]][[Bbb]]  ->  [[ ┃Aaa]][[Bbb]]
                md: [[ Aaa]][[Bbb]]⏎
          0:03  [[A┃aa]][[Bbb]]  ->  [[A ┃aa]][[Bbb]]
                md: [[A aa]][[Bbb]]⏎
          0:04  [[Aa┃a]][[Bbb]]  ->  [[Aa ┃a]][[Bbb]]
                md: [[Aa a]][[Bbb]]⏎
          0:05  [[Aaa┃]][[Bbb]]  ->  [[Aaa ┃]][[Bbb]]
                md: [[Aaa ]][[Bbb]]⏎
          0:06  [[Aaa]┃][[Bbb]]  ->  [[Aaa] ┃][[Bbb]]
                md: [[Aaa] ][[Bbb]]⏎
          0:07  [[Aaa]]┃[[Bbb]]  ->  [[Aaa]] ┃[[Bbb]]
                md: [[Aaa]] [[Bbb]]⏎
          0:08  [[Aaa]][┃[Bbb]]  ->  [[Aaa]][ ┃[Bbb]]
                md: [[Aaa]][ [Bbb]]⏎
          0:09  [[Aaa]][[┃Bbb]]  ->  [[Aaa]][[ ┃Bbb]]
                md: [[Aaa]][[ Bbb]]⏎
          0:10  [[Aaa]][[B┃bb]]  ->  [[Aaa]][[B ┃bb]]
                md: [[Aaa]][[B bb]]⏎
          0:11  [[Aaa]][[Bb┃b]]  ->  [[Aaa]][[Bb ┃b]]
                md: [[Aaa]][[Bb b]]⏎
          0:12  [[Aaa]][[Bbb┃]]  ->  [[Aaa]][[Bbb ┃]]
                md: [[Aaa]][[Bbb ]]⏎
          0:13  [[Aaa]][[Bbb]┃]  ->  [[Aaa]][[Bbb] ┃]
                md: [[Aaa]][[Bbb] ]⏎
          0:14  [[Aaa]][[Bbb]]┃  ->  [[Aaa]][[Bbb]] ┃
                md: [[Aaa]][[Bbb]]⏎
          """
        `)
      } else if (isFirefox()) {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃[[Aaa]][[Bbb]]  ->   ┃[[Aaa]][[Bbb]]
                md:  [[Aaa]][[Bbb]]⏎
          0:01  [┃[Aaa]][[Bbb]]  ->  [ ┃[Aaa]][[Bbb]]
                md: [ [Aaa]][[Bbb]]⏎
          0:02  [[┃Aaa]][[Bbb]]  ->  [[ ┃Aaa]][[Bbb]]
                md: [[ Aaa]][[Bbb]]⏎
          0:03  [[A┃aa]][[Bbb]]  ->  [[A ┃aa]][[Bbb]]
                md: [[A aa]][[Bbb]]⏎
          0:04  [[Aa┃a]][[Bbb]]  ->  [[Aa ┃a]][[Bbb]]
                md: [[Aa a]][[Bbb]]⏎
          0:05  [[Aaa┃]][[Bbb]]  ->  [[Aaa ┃]][[Bbb]]
                md: [[Aaa ]][[Bbb]]⏎
          0:06  [[Aaa]┃][[Bbb]]  ->  [[Aaa] ┃][[Bbb]]
                md: [[Aaa] ][[Bbb]]⏎
          0:07  [[Aaa]]┃[[Bbb]]  ->  [[Aaa]] ┃[[Bbb]]
                md: [[Aaa]] [[Bbb]]⏎
          0:08  [[Aaa]][┃[Bbb]]  ->  [[Aaa]][ ┃[Bbb]]
                md: [[Aaa]][ [Bbb]]⏎
          0:09  [[Aaa]][[┃Bbb]]  ->  [[Aaa]][[ ┃Bbb]]
                md: [[Aaa]][[ Bbb]]⏎
          0:10  [[Aaa]][[B┃bb]]  ->  [[Aaa]][[B ┃bb]]
                md: [[Aaa]][[B bb]]⏎
          0:11  [[Aaa]][[Bb┃b]]  ->  [[Aaa]][[Bb ┃b]]
                md: [[Aaa]][[Bb b]]⏎
          0:12  [[Aaa]][[Bbb┃]]  ->  [[Aaa]][[Bbb ┃]]
                md: [[Aaa]][[Bbb ]]⏎
          0:13  [[Aaa]][[Bbb]┃]  ->  [[Aaa]][[Bbb] ┃]
                md: [[Aaa]][[Bbb] ]⏎
          0:14  [[Aaa]][[Bbb]]┃  ->  [[Aaa]][[Bbb]] ┃
                md: [[Aaa]][[Bbb]]⏎
          """
        `)
      } else {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃[[Aaa]][[Bbb]]  ->   ┃[[Aaa]][[Bbb]]
                md:  [[Aaa]][[Bbb]]⏎
          0:01  [┃[Aaa]][[Bbb]]  ->  [ ┃[Aaa]][[Bbb]]
                md: [ [Aaa]][[Bbb]]⏎
          0:02  [[┃Aaa]][[Bbb]]  ->  [[ ┃Aaa]][[Bbb]]
                md: [[ Aaa]][[Bbb]]⏎
          0:03  [[A┃aa]][[Bbb]]  ->  [[A ┃aa]][[Bbb]]
                md: [[A aa]][[Bbb]]⏎
          0:04  [[Aa┃a]][[Bbb]]  ->  [[Aa ┃a]][[Bbb]]
                md: [[Aa a]][[Bbb]]⏎
          0:05  [[Aaa┃]][[Bbb]]  ->  [[Aaa ┃]][[Bbb]]
                md: [[Aaa ]][[Bbb]]⏎
          0:06  [[Aaa]┃][[Bbb]]  ->  [[Aaa] ┃][[Bbb]]
                md: [[Aaa] ][[Bbb]]⏎
          0:07  [[Aaa]]┃[[Bbb]]  ->  [[Aaa]] ┃[[Bbb]]
                md: [[Aaa]] [[Bbb]]⏎
          0:08  [[Aaa]][┃[Bbb]]  ->  [[Aaa]][ ┃[Bbb]]
                md: [[Aaa]][ [Bbb]]⏎
          0:09  [[Aaa]][[┃Bbb]]  ->  [[Aaa]][[ ┃Bbb]]
                md: [[Aaa]][[ Bbb]]⏎
          0:10  [[Aaa]][[B┃bb]]  ->  [[Aaa]][[B ┃bb]]
                md: [[Aaa]][[B bb]]⏎
          0:11  [[Aaa]][[Bb┃b]]  ->  [[Aaa]][[Bb ┃b]]
                md: [[Aaa]][[Bb b]]⏎
          0:12  [[Aaa]][[Bbb┃]]  ->  [[Aaa]][[Bbb ┃]]
                md: [[Aaa]][[Bbb ]]⏎
          0:13  [[Aaa]][[Bbb]┃]  ->  [[Aaa]][[Bbb] ┃]
                md: [[Aaa]][[Bbb] ]⏎
          0:14  [[Aaa]][[Bbb]]┃  ->  [[Aaa]][[Bbb]] ┃
                md: [[Aaa]][[Bbb]]⏎
          """
        `)
      }
    },
    FUZZ_TIMEOUT,
  )

  it(
    'records Enter at every caret position',
    async () => {
      const table = await fuzzKey(setupFocusParagraphs, ADJACENT_LINES, '{Enter}')
      if (isSafari()) {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃[[Aaa]][[Bbb]]  ->  ⏎┃[[Aaa]][[Bbb]]
                md: [[Aaa]][[Bbb]]⏎
          0:01  [┃[Aaa]][[Bbb]]  ->  [⏎┃[Aaa]][[Bbb]]
                md: [⏎⏎[Aaa]][[Bbb]]⏎
          0:02  [[┃Aaa]][[Bbb]]  ->  [[⏎┃Aaa]][[Bbb]]
                md: [[⏎⏎Aaa]][[Bbb]]⏎
          0:03  [[A┃aa]][[Bbb]]  ->  [[A⏎┃aa]][[Bbb]]
                md: [[A⏎⏎aa]][[Bbb]]⏎
          0:04  [[Aa┃a]][[Bbb]]  ->  [[Aa⏎┃a]][[Bbb]]
                md: [[Aa⏎⏎a]][[Bbb]]⏎
          0:05  [[Aaa┃]][[Bbb]]  ->  [[Aaa⏎┃]][[Bbb]]
                md: [[Aaa⏎⏎]][[Bbb]]⏎
          0:06  [[Aaa]┃][[Bbb]]  ->  [[Aaa]⏎┃][[Bbb]]
                md: [[Aaa]⏎⏎][[Bbb]]⏎
          0:07  [[Aaa]]┃[[Bbb]]  ->  [[Aaa]]⏎┃[[Bbb]]
                md: [[Aaa]]⏎⏎[[Bbb]]⏎
          0:08  [[Aaa]][┃[Bbb]]  ->  [[Aaa]][⏎┃[Bbb]]
                md: [[Aaa]][⏎⏎[Bbb]]⏎
          0:09  [[Aaa]][[┃Bbb]]  ->  [[Aaa]][[⏎┃Bbb]]
                md: [[Aaa]][[⏎⏎Bbb]]⏎
          0:10  [[Aaa]][[B┃bb]]  ->  [[Aaa]][[B⏎┃bb]]
                md: [[Aaa]][[B⏎⏎bb]]⏎
          0:11  [[Aaa]][[Bb┃b]]  ->  [[Aaa]][[Bb⏎┃b]]
                md: [[Aaa]][[Bb⏎⏎b]]⏎
          0:12  [[Aaa]][[Bbb┃]]  ->  [[Aaa]][[Bbb⏎┃]]
                md: [[Aaa]][[Bbb⏎⏎]]⏎
          0:13  [[Aaa]][[Bbb]┃]  ->  [[Aaa]][[Bbb]⏎┃]
                md: [[Aaa]][[Bbb]⏎⏎]⏎
          0:14  [[Aaa]][[Bbb]]┃  ->  [[Aaa]][[Bbb]]⏎┃
                md: [[Aaa]][[Bbb]]⏎
          """
        `)
      } else if (isFirefox()) {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃[[Aaa]][[Bbb]]  ->  ⏎┃[[Aaa]][[Bbb]]
                md: [[Aaa]][[Bbb]]⏎
          0:01  [┃[Aaa]][[Bbb]]  ->  [⏎┃[Aaa]][[Bbb]]
                md: [⏎⏎[Aaa]][[Bbb]]⏎
          0:02  [[┃Aaa]][[Bbb]]  ->  [[⏎┃Aaa]][[Bbb]]
                md: [[⏎⏎Aaa]][[Bbb]]⏎
          0:03  [[A┃aa]][[Bbb]]  ->  [[A⏎┃aa]][[Bbb]]
                md: [[A⏎⏎aa]][[Bbb]]⏎
          0:04  [[Aa┃a]][[Bbb]]  ->  [[Aa⏎┃a]][[Bbb]]
                md: [[Aa⏎⏎a]][[Bbb]]⏎
          0:05  [[Aaa┃]][[Bbb]]  ->  [[Aaa⏎┃]][[Bbb]]
                md: [[Aaa⏎⏎]][[Bbb]]⏎
          0:06  [[Aaa]┃][[Bbb]]  ->  [[Aaa]⏎┃][[Bbb]]
                md: [[Aaa]⏎⏎][[Bbb]]⏎
          0:07  [[Aaa]]┃[[Bbb]]  ->  [[Aaa]]⏎┃[[Bbb]]
                md: [[Aaa]]⏎⏎[[Bbb]]⏎
          0:08  [[Aaa]][┃[Bbb]]  ->  [[Aaa]][⏎┃[Bbb]]
                md: [[Aaa]][⏎⏎[Bbb]]⏎
          0:09  [[Aaa]][[┃Bbb]]  ->  [[Aaa]][[⏎┃Bbb]]
                md: [[Aaa]][[⏎⏎Bbb]]⏎
          0:10  [[Aaa]][[B┃bb]]  ->  [[Aaa]][[B⏎┃bb]]
                md: [[Aaa]][[B⏎⏎bb]]⏎
          0:11  [[Aaa]][[Bb┃b]]  ->  [[Aaa]][[Bb⏎┃b]]
                md: [[Aaa]][[Bb⏎⏎b]]⏎
          0:12  [[Aaa]][[Bbb┃]]  ->  [[Aaa]][[Bbb⏎┃]]
                md: [[Aaa]][[Bbb⏎⏎]]⏎
          0:13  [[Aaa]][[Bbb]┃]  ->  [[Aaa]][[Bbb]⏎┃]
                md: [[Aaa]][[Bbb]⏎⏎]⏎
          0:14  [[Aaa]][[Bbb]]┃  ->  [[Aaa]][[Bbb]]⏎┃
                md: [[Aaa]][[Bbb]]⏎
          """
        `)
      } else {
        expect(table).toMatchInlineSnapshot(`
          """
          0:00  ┃[[Aaa]][[Bbb]]  ->  ⏎┃[[Aaa]][[Bbb]]
                md: [[Aaa]][[Bbb]]⏎
          0:01  [┃[Aaa]][[Bbb]]  ->  [⏎┃[Aaa]][[Bbb]]
                md: [⏎⏎[Aaa]][[Bbb]]⏎
          0:02  [[┃Aaa]][[Bbb]]  ->  [[⏎┃Aaa]][[Bbb]]
                md: [[⏎⏎Aaa]][[Bbb]]⏎
          0:03  [[A┃aa]][[Bbb]]  ->  [[A⏎┃aa]][[Bbb]]
                md: [[A⏎⏎aa]][[Bbb]]⏎
          0:04  [[Aa┃a]][[Bbb]]  ->  [[Aa⏎┃a]][[Bbb]]
                md: [[Aa⏎⏎a]][[Bbb]]⏎
          0:05  [[Aaa┃]][[Bbb]]  ->  [[Aaa⏎┃]][[Bbb]]
                md: [[Aaa⏎⏎]][[Bbb]]⏎
          0:06  [[Aaa]┃][[Bbb]]  ->  [[Aaa]⏎┃][[Bbb]]
                md: [[Aaa]⏎⏎][[Bbb]]⏎
          0:07  [[Aaa]]┃[[Bbb]]  ->  [[Aaa]]⏎┃[[Bbb]]
                md: [[Aaa]]⏎⏎[[Bbb]]⏎
          0:08  [[Aaa]][┃[Bbb]]  ->  [[Aaa]][⏎┃[Bbb]]
                md: [[Aaa]][⏎⏎[Bbb]]⏎
          0:09  [[Aaa]][[┃Bbb]]  ->  [[Aaa]][[⏎┃Bbb]]
                md: [[Aaa]][[⏎⏎Bbb]]⏎
          0:10  [[Aaa]][[B┃bb]]  ->  [[Aaa]][[B⏎┃bb]]
                md: [[Aaa]][[B⏎⏎bb]]⏎
          0:11  [[Aaa]][[Bb┃b]]  ->  [[Aaa]][[Bb⏎┃b]]
                md: [[Aaa]][[Bb⏎⏎b]]⏎
          0:12  [[Aaa]][[Bbb┃]]  ->  [[Aaa]][[Bbb⏎┃]]
                md: [[Aaa]][[Bbb⏎⏎]]⏎
          0:13  [[Aaa]][[Bbb]┃]  ->  [[Aaa]][[Bbb]⏎┃]
                md: [[Aaa]][[Bbb]⏎⏎]⏎
          0:14  [[Aaa]][[Bbb]]┃  ->  [[Aaa]][[Bbb]]⏎┃
                md: [[Aaa]][[Bbb]]⏎
          """
        `)
      }
    },
    FUZZ_TIMEOUT,
  )
})
