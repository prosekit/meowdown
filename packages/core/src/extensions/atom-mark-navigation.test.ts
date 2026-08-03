import { TextSelection } from '@prosekit/pm/state'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { findText } from '../testing/find-text.ts'
import {
  formatSelectionSteps,
  setupFixture,
  traceKeySelection,
  traceShiftKeySelection,
  type Fixture,
} from '../testing/index.ts'

import { defineImage } from './image.ts'
import type { MarkMode } from './mark-mode.ts'

const YOUTUBE = '![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)'
const TWEET = '![](https://twitter.com/jack/status/20)'

function getSVGImageURL(width: number, height: number): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<rect width="${width}" height="${height}" fill="pink"/>` +
    `</svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

// An editor with one paragraph per entry in `paragraphs`.
function setup(mode: MarkMode, paragraphs: string[]): Fixture {
  const fixture = setupFixture({ extensionOptions: { markMode: mode } })
  const { editor, n } = fixture
  editor.use(
    defineImage({ resolveImageUrl: () => getSVGImageURL(24, 24), persistTweetHeight: false }),
  )
  fixture.set(n.doc(...paragraphs.map((text) => n.paragraph(text))))
  fixture.view.focus()
  return fixture
}

// Drop the caret at `pos` through a dispatched transaction: what a host
// command, an undo remap or (with `isPointer`) the browser's own hit testing
// does. `pointer` is the meta prosemirror-view puts on pointer selections.
function dropCaret(fixture: Fixture, pos: number, isPointer = false): void {
  const tr = fixture.state.tr.setSelection(TextSelection.create(fixture.doc, pos))
  fixture.view.dispatch(isPointer ? tr.setMeta('pointer', true) : tr)
}

// Drop a range selection the same way, from `anchor` to `head`. A drag arrives
// exactly like this, `pointer` meta included.
function dropRange(fixture: Fixture, anchor: number, head: number, isPointer = false): void {
  const tr = fixture.state.tr.setSelection(TextSelection.create(fixture.doc, anchor, head))
  fixture.view.dispatch(isPointer ? tr.setMeta('pointer', true) : tr)
}

async function walkKey(fixture: Fixture, key: string, times: number): Promise<string> {
  return formatSelectionSteps(await traceKeySelection(fixture, key, times))
}

async function walkShiftKey(fixture: Fixture, key: string, times: number): Promise<string> {
  return formatSelectionSteps(await traceShiftKeySelection(fixture, key, times))
}

describe('caret navigation across atom-only paragraphs', () => {
  it('focus: ArrowLeft from after the tweet walks back through both embeds', async () => {
    using fixture = setup('focus', [YOUTUBE, `${TWEET}<a>`])
    expect(await walkKey(fixture, 'ArrowLeft', 5)).toMatchInlineSnapshot(`
      """
      ![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)
      ![](https://twitter.com/jack/status/20)┃
      ----------
      ![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)
      ❰![](https://twitter.com/jack/status/20)❱
      ----------
      ![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)
      ┃![](https://twitter.com/jack/status/20)
      ----------
      ![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)┃
      ![](https://twitter.com/jack/status/20)
      ----------
      ❰![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)❱
      ![](https://twitter.com/jack/status/20)
      ----------
      ┃![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)
      ![](https://twitter.com/jack/status/20)
      """
    `)
  })

  it('focus: ArrowRight from before the youtube walks forward through both embeds', async () => {
    using fixture = setup('focus', [`<a>${YOUTUBE}`, TWEET])
    expect(await walkKey(fixture, 'ArrowRight', 5)).toMatchInlineSnapshot(`
      """
      ┃![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)
      ![](https://twitter.com/jack/status/20)
      ----------
      ❰![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)❱
      ![](https://twitter.com/jack/status/20)
      ----------
      ![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)┃
      ![](https://twitter.com/jack/status/20)
      ----------
      ![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)
      ┃![](https://twitter.com/jack/status/20)
      ----------
      ![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)
      ❰![](https://twitter.com/jack/status/20)❱
      ----------
      ![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)
      ![](https://twitter.com/jack/status/20)┃
      """
    `)
  })

  it('hide: ArrowLeft from after the tweet walks back through both embeds', async () => {
    using fixture = setup('hide', [YOUTUBE, `${TWEET}<a>`])
    expect(await walkKey(fixture, 'ArrowLeft', 5)).toMatchInlineSnapshot(`
      """
      ![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)
      ![](https://twitter.com/jack/status/20)┃
      ----------
      ![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)
      ❰![](https://twitter.com/jack/status/20)❱
      ----------
      ![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)
      ┃![](https://twitter.com/jack/status/20)
      ----------
      ![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)┃
      ![](https://twitter.com/jack/status/20)
      ----------
      ❰![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)❱
      ![](https://twitter.com/jack/status/20)
      ----------
      ┃![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)
      ![](https://twitter.com/jack/status/20)
      """
    `)
  })

  it('show: ArrowLeft from after the tweet walks back through both embeds', async () => {
    using fixture = setup('show', [YOUTUBE, `${TWEET}<a>`])
    expect(await walkKey(fixture, 'ArrowLeft', 5)).toMatchInlineSnapshot(`
      """
      ![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)
      ![](https://twitter.com/jack/status/20)┃
      ----------
      ![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)
      ❰![](https://twitter.com/jack/status/20)❱
      ----------
      ![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)
      ┃![](https://twitter.com/jack/status/20)
      ----------
      ![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)┃
      ![](https://twitter.com/jack/status/20)
      ----------
      ❰![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)❱
      ![](https://twitter.com/jack/status/20)
      ----------
      ┃![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)
      ![](https://twitter.com/jack/status/20)
      """
    `)
  })

  it('focus: ArrowLeft with plain images instead of embeds', async () => {
    using fixture = setup('focus', ['![a](one.png)', '![b](two.png)<a>'])
    expect(await walkKey(fixture, 'ArrowLeft', 5)).toMatchInlineSnapshot(`
      """
      ![a](one.png)
      ![b](two.png)┃
      ----------
      ![a](one.png)
      ❰![b](two.png)❱
      ----------
      ![a](one.png)
      ┃![b](two.png)
      ----------
      ![a](one.png)┃
      ![b](two.png)
      ----------
      ❰![a](one.png)❱
      ![b](two.png)
      ----------
      ┃![a](one.png)
      ![b](two.png)
      """
    `)
  })

  it('focus: ArrowLeft from an embed paragraph into a text paragraph', async () => {
    using fixture = setup('focus', ['hello', `${TWEET}<a>`])
    expect(await walkKey(fixture, 'ArrowLeft', 4)).toMatchInlineSnapshot(`
      """
      hello
      ![](https://twitter.com/jack/status/20)┃
      ----------
      hello
      ❰![](https://twitter.com/jack/status/20)❱
      ----------
      hello
      ┃![](https://twitter.com/jack/status/20)
      ----------
      hello┃
      ![](https://twitter.com/jack/status/20)
      ----------
      hell┃o
      ![](https://twitter.com/jack/status/20)
      """
    `)
  })

  it('focus: ArrowRight from a text paragraph into an embed paragraph', async () => {
    using fixture = setup('focus', ['hello<a>', TWEET])
    expect(await walkKey(fixture, 'ArrowRight', 3)).toMatchInlineSnapshot(`
      """
      hello┃
      ![](https://twitter.com/jack/status/20)
      ----------
      hello
      ┃![](https://twitter.com/jack/status/20)
      ----------
      hello
      ❰![](https://twitter.com/jack/status/20)❱
      ----------
      hello
      ![](https://twitter.com/jack/status/20)┃
      """
    `)
  })

  it('focus: ArrowRight from an embed paragraph into a text paragraph', async () => {
    using fixture = setup('focus', [`${YOUTUBE}<a>`, 'world'])
    expect(await walkKey(fixture, 'ArrowRight', 2)).toMatchInlineSnapshot(`
      """
      ![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)┃
      world
      ----------
      ![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)
      ┃world
      ----------
      ![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)
      w┃orld
      """
    `)
  })

  it('focus: ArrowLeft from a text paragraph into an embed paragraph', async () => {
    using fixture = setup('focus', [YOUTUBE, '<a>world'])
    expect(await walkKey(fixture, 'ArrowLeft', 3)).toMatchInlineSnapshot(`
      """
      ![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)
      ┃world
      ----------
      ![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)┃
      world
      ----------
      ❰![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)❱
      world
      ----------
      ┃![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)
      world
      """
    `)
  })
})

describe('shift selection across atom-only paragraphs', () => {
  it('focus: Shift-ArrowLeft from after the tweet extends back through both embeds', async () => {
    using fixture = setup('focus', [YOUTUBE, `${TWEET}<a>`])
    expect(await walkShiftKey(fixture, 'ArrowLeft', 3)).toMatchInlineSnapshot(`
      """
      ![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)
      ![](https://twitter.com/jack/status/20)┃
      ----------
      ![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)
      ❰![](https://twitter.com/jack/status/20)❱
      ----------
      ![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)❰
      ![](https://twitter.com/jack/status/20)❱
      ----------
      ❰![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)
      ![](https://twitter.com/jack/status/20)❱
      """
    `)
  })

  it('focus: Shift-ArrowRight from before the youtube extends through both embeds', async () => {
    using fixture = setup('focus', [`<a>${YOUTUBE}`, TWEET])
    expect(await walkShiftKey(fixture, 'ArrowRight', 3)).toMatchInlineSnapshot(`
      """
      ┃![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)
      ![](https://twitter.com/jack/status/20)
      ----------
      ❰![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)❱
      ![](https://twitter.com/jack/status/20)
      ----------
      ❰![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)
      ❱![](https://twitter.com/jack/status/20)
      ----------
      ❰![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)
      ![](https://twitter.com/jack/status/20)❱
      """
    `)
  })

  it('focus: Shift-ArrowLeft in one paragraph swallows the image as a unit', async () => {
    using fixture = setup('focus', ['ABC![img](url)D<a>EF'])
    expect(await walkShiftKey(fixture, 'ArrowLeft', 3)).toMatchInlineSnapshot(`
      """
      ABC![img](url)D┃EF
      ----------
      ABC![img](url)❰D❱EF
      ----------
      ABC❰![img](url)D❱EF
      ----------
      AB❰C![img](url)D❱EF
      """
    `)
  })

  it('focus: Shift-ArrowLeft from an embed paragraph into a text paragraph', async () => {
    using fixture = setup('focus', ['hello', `${TWEET}<a>`])
    expect(await walkShiftKey(fixture, 'ArrowLeft', 3)).toMatchInlineSnapshot(`
      """
      hello
      ![](https://twitter.com/jack/status/20)┃
      ----------
      hello
      ❰![](https://twitter.com/jack/status/20)❱
      ----------
      hello❰
      ![](https://twitter.com/jack/status/20)❱
      ----------
      hell❰o
      ![](https://twitter.com/jack/status/20)❱
      """
    `)
  })
})

// Editing beside a unit is the editor's own transaction, never the browser's
// native edit: Gecko's forward delete next to the zero-width source takes the
// rest of the textblock with it. The caret snap cannot undo that, since the
// write and the snap live in the same transaction, so these keys are the whole
// defense and must stay covered.
describe('editing next to an atom unit', () => {
  it('focus: Backspace removes the space before a unit', async () => {
    using fixture = setup('focus', ['see <a>[[Aaa]] here'])
    await userEvent.keyboard('{Backspace}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"see┃[[Aaa]] here"`)
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      see[[Aaa]] here

      """
    `)
  })

  it('focus: Backspace removes the letter before a unit', async () => {
    using fixture = setup('focus', ['a<a>[[Aaa]] b'])
    await userEvent.keyboard('{Backspace}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"┃[[Aaa]] b"`)
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      [[Aaa]] b

      """
    `)
  })

  it('focus: Backspace at the block start before a unit changes nothing', async () => {
    using fixture = setup('focus', ['<a>[[Aaa]] b'])
    await userEvent.keyboard('{Backspace}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"┃[[Aaa]] b"`)
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      [[Aaa]] b

      """
    `)
  })

  it('focus: Delete removes the space after a unit', async () => {
    using fixture = setup('focus', ['see [[Aaa]]<a> here'])
    await userEvent.keyboard('{Delete}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"see [[Aaa]]┃here"`)
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      see [[Aaa]]here

      """
    `)
  })

  it('focus: Delete removes the letter after a unit, not the rest of the block', async () => {
    using fixture = setup('focus', ['a [[Aaa]]<a>b c'])
    await userEvent.keyboard('{Delete}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"a [[Aaa]]┃ c"`)
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      a [[Aaa]] c

      """
    `)
  })

  it('focus: Delete at the block end after a unit changes nothing', async () => {
    using fixture = setup('focus', ['a [[Aaa]]<a>'])
    await userEvent.keyboard('{Delete}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"a [[Aaa]]┃"`)
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      a [[Aaa]]

      """
    `)
  })

  it('focus: ArrowRight past a unit steps one character into the text after it', async () => {
    using fixture = setup('focus', ['see [[Aaa]]<a> here'])
    await userEvent.keyboard('{ArrowRight}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"see [[Aaa]] ┃here"`)
  })

  it('focus: ArrowRight after a unit at the block end stays put', async () => {
    using fixture = setup('focus', ['see [[Aaa]]<a>'])
    await userEvent.keyboard('{ArrowRight}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"see [[Aaa]]┃"`)
  })
})

describe('caret snapping out of hidden atom source', () => {
  it('focus: a caret dropped inside the source leaves through the end it travelled towards', () => {
    using fixture = setup('focus', ['see [[Aaa]] here'])
    dropCaret(fixture, findText(fixture.doc, '[[Aaa]]') + 3)
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"see [[Aaa]]┃ here"`)
  })

  it('focus: a caret dropped inside the source leaves through the start when it came from the right', () => {
    using fixture = setup('focus', ['see [[Aaa]] here'])
    dropCaret(fixture, findText(fixture.doc, '[[Aaa]]') + 8)
    dropCaret(fixture, findText(fixture.doc, '[[Aaa]]') + 3)
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"see ┃[[Aaa]] here"`)
  })

  it('focus: a pointer caret inside the source takes the edge it landed nearest', () => {
    using fixture = setup('focus', ['see [[Aaa]] here'])
    dropCaret(fixture, findText(fixture.doc, '[[Aaa]]') + 1, true)
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"see ┃[[Aaa]] here"`)

    dropCaret(fixture, findText(fixture.doc, '[[Aaa]]') + 6, true)
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"see [[Aaa]]┃ here"`)
  })

  it('focus: a caret already on a unit edge stays put', () => {
    using fixture = setup('focus', ['see [[Aaa]] here'])
    dropCaret(fixture, findText(fixture.doc, '[[Aaa]]'))
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"see ┃[[Aaa]] here"`)

    dropCaret(fixture, findText(fixture.doc, '[[Aaa]]') + 7)
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"see [[Aaa]]┃ here"`)
  })

  it('focus: Backspace from inside the source removes the whole unit', async () => {
    using fixture = setup('focus', ['see [[Aaa]] here'])
    dropCaret(fixture, findText(fixture.doc, '[[Aaa]]') + 3)
    await userEvent.keyboard('{Backspace}')
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      see  here

      """
    `)
  })

  it('focus: Delete from inside the source removes the whole unit', async () => {
    using fixture = setup('focus', ['see [[Aaa]] here'])
    dropCaret(fixture, findText(fixture.doc, '[[Aaa]]') + 8)
    dropCaret(fixture, findText(fixture.doc, '[[Aaa]]') + 3)
    await userEvent.keyboard('{Delete}')
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      see  here

      """
    `)
  })

  it('focus: a typed character from inside the source lands outside the unit', async () => {
    using fixture = setup('focus', ['see [[Aaa]] here'])
    dropCaret(fixture, findText(fixture.doc, '[[Aaa]]') + 3)
    await userEvent.keyboard('X')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"see [[Aaa]]X┃ here"`)
  })

  it('focus: Space from inside the source lands outside the unit', async () => {
    using fixture = setup('focus', ['see [[Aaa]] here'])
    dropCaret(fixture, findText(fixture.doc, '[[Aaa]]') + 3)
    await userEvent.keyboard(' ')
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      see [[Aaa]]  here

      """
    `)
  })

  it('focus: Enter from inside the source splits at the unit edge', async () => {
    using fixture = setup('focus', ['see [[Aaa]] here'])
    dropCaret(fixture, findText(fixture.doc, '[[Aaa]]') + 3)
    await userEvent.keyboard('{Enter}')
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      see [[Aaa]]

       here

      """
    `)
  })

  it('focus: a caret dropped inside an image source leaves the unit too', () => {
    using fixture = setup('focus', ['see ![a](one.png) here'])
    dropCaret(fixture, findText(fixture.doc, '![a](one.png)') + 5)
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"see ![a](one.png)┃ here"`)
  })

  it('hide: a caret dropped inside the source leaves the unit', () => {
    using fixture = setup('hide', ['see [[Aaa]] here'])
    dropCaret(fixture, findText(fixture.doc, '[[Aaa]]') + 3)
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"see [[Aaa]]┃ here"`)
  })

  it('show: a caret dropped inside the source leaves the unit', () => {
    using fixture = setup('show', ['see [[Aaa]] here'])
    dropCaret(fixture, findText(fixture.doc, '[[Aaa]]') + 3)
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"see [[Aaa]]┃ here"`)
  })

  it('focus: typing a wikilink by hand still ends up outside the finished unit', async () => {
    using fixture = setup('focus', ['see <a>'])
    // `[[` is the escape for a literal `[` in userEvent's keyboard syntax.
    await userEvent.keyboard('[[[[Aaa]]')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"see [[Aaa]]┃"`)
  })
})

describe('dragged selections growing to whole atom units', () => {
  it('focus: a drag ending inside the source swallows the unit whole', () => {
    using fixture = setup('focus', ['see [[Aaa]] here'])
    dropRange(fixture, 1, findText(fixture.doc, '[[Aaa]]') + 4, true)
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"❰see [[Aaa]]❱ here"`)
  })

  it('focus: a drag starting inside the source swallows the unit whole', () => {
    using fixture = setup('focus', ['see [[Aaa]] here'])
    dropRange(
      fixture,
      findText(fixture.doc, '[[Aaa]]') + 4,
      findText(fixture.doc, ' here') + 5,
      true,
    )
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"see ❰[[Aaa]] here❱"`)
  })

  it('focus: a backwards drag keeps its direction while growing', () => {
    using fixture = setup('focus', ['see [[Aaa]] here'])
    const head = findText(fixture.doc, '[[Aaa]]') + 4
    dropRange(fixture, findText(fixture.doc, ' here') + 5, head, true)
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"see ❰[[Aaa]] here❱"`)
    expect(fixture.state.selection.head).toBe(findText(fixture.doc, '[[Aaa]]'))
  })

  it('focus: typing over a drag that cut the source keeps the unit whole', async () => {
    using fixture = setup('focus', ['see [[Aaa]] here'])
    dropRange(fixture, 1, findText(fixture.doc, '[[Aaa]]') + 4, true)
    await userEvent.keyboard('X')
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      X here

      """
    `)
  })

  it('focus: a drag inside plain text is left alone', () => {
    using fixture = setup('focus', ['see [[Aaa]] here'])
    dropRange(fixture, 1, 3, true)
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"❰se❱e [[Aaa]] here"`)
  })

  it('focus: a selection that is not from a pointer keeps its endpoints', () => {
    using fixture = setup('focus', ['see [[Aaa]] here'])
    dropRange(fixture, 1, findText(fixture.doc, '[[Aaa]]') + 4)
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"❰see [[Aa❱a]] here"`)
  })

  it('focus: a drag ending inside an image source swallows the image whole', () => {
    using fixture = setup('focus', ['see ![a](one.png) here'])
    dropRange(fixture, 1, findText(fixture.doc, '![a](one.png)') + 5, true)
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"❰see ![a](one.png)❱ here"`)
  })
})

describe('caret navigation between adjacent inline units', () => {
  it('focus: ArrowRight between an image and a following wikilink', async () => {
    using fixture = setup('focus', ['see <a>![pic](https://example.com/a.png)[[Aaa]] here'])
    expect(await walkKey(fixture, 'ArrowRight', 4)).toMatchInlineSnapshot(`
      """
      see ┃![pic](https://example.com/a.png)[[Aaa]] here
      ----------
      see ❰![pic](https://example.com/a.png)❱[[Aaa]] here
      ----------
      see ![pic](https://example.com/a.png)┃[[Aaa]] here
      ----------
      see ![pic](https://example.com/a.png)❰[[Aaa]]❱ here
      ----------
      see ![pic](https://example.com/a.png)[[Aaa]]┃ here
      """
    `)
  })

  it('focus: Backspace between two adjacent wikilinks removes the whole left one', async () => {
    using fixture = setup('focus', ['see [[Aaa]][[Bbb]]<a> here'])
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    await userEvent.keyboard('{Backspace}')
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      see [[Bbb]] here

      """
    `)
  })

  it('focus: Delete between an image and a following wikilink removes the whole wikilink', async () => {
    using fixture = setup('focus', ['see <a>![pic](https://example.com/a.png)[[Aaa]] here'])
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    await userEvent.keyboard('{Delete}')
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      see ![pic](https://example.com/a.png) here

      """
    `)
  })

  it('focus: Shift-ArrowLeft from between two adjacent wikilinks swallows the left one whole', async () => {
    using fixture = setup('focus', ['see [[Aaa]][[Bbb]]<a> here'])
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"see ❰[[Aaa]]❱[[Bbb]] here"`)
  })

  it('focus: ArrowLeft walks over a wikilink followed by an image as two units', async () => {
    using fixture = setup('focus', ['see [[Aaa]]![pic](https://example.com/a.png)<a> here'])
    expect(await walkKey(fixture, 'ArrowLeft', 4)).toMatchInlineSnapshot(`
      """
      see [[Aaa]]![pic](https://example.com/a.png)┃ here
      ----------
      see [[Aaa]]❰![pic](https://example.com/a.png)❱ here
      ----------
      see [[Aaa]]┃![pic](https://example.com/a.png) here
      ----------
      see ❰[[Aaa]]❱![pic](https://example.com/a.png) here
      ----------
      see ┃[[Aaa]]![pic](https://example.com/a.png) here
      """
    `)
  })

  it('hide: ArrowLeft walks over two adjacent wikilinks as two units', async () => {
    using fixture = setup('hide', ['see [[Aaa]][[Bbb]]<a> here'])
    expect(await walkKey(fixture, 'ArrowLeft', 4)).toMatchInlineSnapshot(`
      """
      see [[Aaa]][[Bbb]]┃ here
      ----------
      see [[Aaa]]❰[[Bbb]]❱ here
      ----------
      see [[Aaa]]┃[[Bbb]] here
      ----------
      see ❰[[Aaa]]❱[[Bbb]] here
      ----------
      see ┃[[Aaa]][[Bbb]] here
      """
    `)
  })

  it('focus: ArrowLeft between two adjacent wikilinks', async () => {
    using fixture = setup('focus', ['see [[Aaa]][[Bbb]]<a> here'])
    expect(await walkKey(fixture, 'ArrowLeft', 4)).toMatchInlineSnapshot(`
      """
      see [[Aaa]][[Bbb]]┃ here
      ----------
      see [[Aaa]]❰[[Bbb]]❱ here
      ----------
      see [[Aaa]]┃[[Bbb]] here
      ----------
      see ❰[[Aaa]]❱[[Bbb]] here
      ----------
      see ┃[[Aaa]][[Bbb]] here
      """
    `)
  })
})
