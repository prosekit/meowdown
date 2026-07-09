import { describe, expect, it } from 'vitest'

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
  editor.use(defineImage({ resolveImageUrl: () => getSVGImageURL(24, 24) }))
  fixture.set(n.doc(...paragraphs.map((text) => n.paragraph(text))))
  fixture.view.focus()
  return fixture
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
      "
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
      "
    `)
  })

  it('focus: ArrowRight from before the youtube walks forward through both embeds', async () => {
    using fixture = setup('focus', [`<a>${YOUTUBE}`, TWEET])
    expect(await walkKey(fixture, 'ArrowRight', 5)).toMatchInlineSnapshot(`
      "
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
      "
    `)
  })

  it('hide: ArrowLeft from after the tweet walks back through both embeds', async () => {
    using fixture = setup('hide', [YOUTUBE, `${TWEET}<a>`])
    expect(await walkKey(fixture, 'ArrowLeft', 5)).toMatchInlineSnapshot(`
      "
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
      "
    `)
  })

  it('show: ArrowLeft from after the tweet walks back through both embeds', async () => {
    using fixture = setup('show', [YOUTUBE, `${TWEET}<a>`])
    expect(await walkKey(fixture, 'ArrowLeft', 5)).toMatchInlineSnapshot(`
      "
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
      "
    `)
  })

  it('focus: ArrowLeft with plain images instead of embeds', async () => {
    using fixture = setup('focus', ['![a](one.png)', '![b](two.png)<a>'])
    expect(await walkKey(fixture, 'ArrowLeft', 5)).toMatchInlineSnapshot(`
      "
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
      "
    `)
  })

  it('focus: ArrowLeft from an embed paragraph into a text paragraph', async () => {
    using fixture = setup('focus', ['hello', `${TWEET}<a>`])
    expect(await walkKey(fixture, 'ArrowLeft', 4)).toMatchInlineSnapshot(`
      "
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
      "
    `)
  })

  it('focus: ArrowRight from a text paragraph into an embed paragraph', async () => {
    using fixture = setup('focus', ['hello<a>', TWEET])
    expect(await walkKey(fixture, 'ArrowRight', 3)).toMatchInlineSnapshot(`
      "
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
      "
    `)
  })

  it('focus: ArrowRight from an embed paragraph into a text paragraph', async () => {
    using fixture = setup('focus', [`${YOUTUBE}<a>`, 'world'])
    expect(await walkKey(fixture, 'ArrowRight', 2)).toMatchInlineSnapshot(`
      "
      ![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)┃
      world
      ----------
      ![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)
      ┃world
      ----------
      ![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)
      w┃orld
      "
    `)
  })

  it('focus: ArrowLeft from a text paragraph into an embed paragraph', async () => {
    using fixture = setup('focus', [YOUTUBE, '<a>world'])
    expect(await walkKey(fixture, 'ArrowLeft', 3)).toMatchInlineSnapshot(`
      "
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
      "
    `)
  })
})

describe('shift selection across atom-only paragraphs', () => {
  it('focus: Shift-ArrowLeft from after the tweet extends back through both embeds', async () => {
    using fixture = setup('focus', [YOUTUBE, `${TWEET}<a>`])
    expect(await walkShiftKey(fixture, 'ArrowLeft', 3)).toMatchInlineSnapshot(`
      "
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
      "
    `)
  })

  it('focus: Shift-ArrowRight from before the youtube extends through both embeds', async () => {
    using fixture = setup('focus', [`<a>${YOUTUBE}`, TWEET])
    expect(await walkShiftKey(fixture, 'ArrowRight', 3)).toMatchInlineSnapshot(`
      "
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
      "
    `)
  })

  it('focus: Shift-ArrowLeft in one paragraph swallows the image as a unit', async () => {
    using fixture = setup('focus', ['ABC![img](url)D<a>EF'])
    expect(await walkShiftKey(fixture, 'ArrowLeft', 3)).toMatchInlineSnapshot(`
      "
      ABC![img](url)D┃EF
      ----------
      ABC![img](url)❰D❱EF
      ----------
      ABC❰![img](url)D❱EF
      ----------
      AB❰C![img](url)D❱EF
      "
    `)
  })

  it('focus: Shift-ArrowLeft from an embed paragraph into a text paragraph', async () => {
    using fixture = setup('focus', ['hello', `${TWEET}<a>`])
    expect(await walkShiftKey(fixture, 'ArrowLeft', 3)).toMatchInlineSnapshot(`
      "
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
      "
    `)
  })
})
