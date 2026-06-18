import { createMarkBuilders } from '@prosekit/core'
import { beforeAll, describe, expect, it } from 'vitest'

import { defineEditorExtension, type EditorExtension } from './extension.ts'
import { inlineTextToMarkChunks } from './inline-text-to-mark-chunks.ts'
import type { MarkChunk } from './mark-chunk.ts'
import type { TypedMarkBuilders } from './schema.ts'

/**
 * Helper: serialize chunk to a compact string form so inline
 * snapshots stay readable. Each chunk becomes
 * `from-to: mark1 + mark2(attrs)`.
 */
function formatMarkChunk([from, to, marks]: MarkChunk): string {
  const names = marks
    .map((mark) => {
      const attrs = mark.attrs as Record<string, unknown>
      const keys = Object.keys(attrs)
      if (keys.length === 0) return mark.type.name
      const filtered = keys.filter((k) => attrs[k] !== '' && attrs[k] !== null)
      if (filtered.length === 0) return mark.type.name
      const attrStr = filtered.map((k) => `${k}=${attrs[k] as string}`).join(',')
      return `${mark.type.name}(${attrStr})`
    })
    .sort()
    .join(' + ')
  return `${from}-${to}: ${names || '-'}`
}

function foramtMarkChunks(chunks: MarkChunk[]): string {
  return '\n' + chunks.map(formatMarkChunk).join('\n') + '\n'
}

describe('inlineTextToMarkChunks', () => {
  let markBuilders: TypedMarkBuilders

  beforeAll(() => {
    const schema = defineEditorExtension().schema!
    markBuilders = createMarkBuilders<EditorExtension>(schema)
  })

  it('plain text returns no chunks (no marks anywhere)', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'hello world')
    // Pure text has no inline nodes; the implementation does not emit
    // a "no-mark" gap when the entire range is plain.
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-11: -
      "
    `)
  })

  it('emphasis yields gap + mark + content + mark', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'Hello *world*')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-6: -
      6-7: mdEm + mdMark
      7-12: mdEm
      12-13: mdEm + mdMark
      "
    `)
  })

  it('strong emphasis', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'a **bold** b')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: -
      2-4: mdMark + mdStrong
      4-8: mdStrong
      8-10: mdMark + mdStrong
      10-12: -
      "
    `)
  })

  it('inline code', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'a `c` b')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: -
      2-3: mdCode + mdMark
      3-4: mdCode
      4-5: mdCode + mdMark
      5-7: -
      "
    `)
  })

  it('strikethrough', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'a ~~b~~ c')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: -
      2-4: mdDel + mdMark
      4-5: mdDel
      5-7: mdDel + mdMark
      7-9: -
      "
    `)
  })

  it('link with href on its text portion', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'see [docs](http://x) now')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-4: -
      4-5: mdLinkText(href=http://x) + mdMark
      5-9: mdLinkText(href=http://x)
      9-11: mdMark
      11-19: mdLinkUri
      19-20: mdMark
      20-24: -
      "
    `)
  })

  it('link with emphasis nested inside the text', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '[*ital*](http://x)')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-1: mdLinkText(href=http://x) + mdMark
      1-2: mdEm + mdLinkText(href=http://x) + mdMark
      2-6: mdEm + mdLinkText(href=http://x)
      6-7: mdEm + mdLinkText(href=http://x) + mdMark
      7-9: mdMark
      9-17: mdLinkUri
      17-18: mdMark
      "
    `)
  })

  it('image: mdImageSource over the source, mdImageView on the final char', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'see ![alt](http://x/p.png) end')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-4: -
      4-6: mdImageSource(src=http://x/p.png,alt=alt) + mdMark
      6-9: mdImageSource(src=http://x/p.png,alt=alt)
      9-11: mdImageSource(src=http://x/p.png,alt=alt) + mdMark
      11-25: mdImageSource(src=http://x/p.png,alt=alt) + mdLinkUri
      25-26: mdImageSource(src=http://x/p.png,alt=alt) + mdImageView(src=http://x/p.png,alt=alt) + mdMark
      26-30: -
      "
    `)
  })

  it('image with empty alt', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '![](z.png)')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-4: mdImageSource(src=z.png) + mdMark
      4-9: mdImageSource(src=z.png) + mdLinkUri
      9-10: mdImageSource(src=z.png) + mdImageView(src=z.png) + mdMark
      "
    `)
  })

  it('reference image does not get image marks (falls through to the link walk)', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'a ![b][id] c')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: -
      2-4: mdMark
      4-5: -
      5-6: mdMark
      6-12: -
      "
    `)
  })

  it('image with a title leaves the title node unmarked', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '![a](http://x "t")')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: mdImageSource(src=http://x,alt=a) + mdMark
      2-3: mdImageSource(src=http://x,alt=a)
      3-5: mdImageSource(src=http://x,alt=a) + mdMark
      5-13: mdImageSource(src=http://x,alt=a) + mdLinkUri
      13-17: mdImageSource(src=http://x,alt=a)
      17-18: mdImageSource(src=http://x,alt=a) + mdImageView(src=http://x,alt=a) + mdMark
      "
    `)
  })

  it('image with formatted alt marks the nested emphasis', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '![a **b** c](http://x)')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: mdImageSource(src=http://x,alt=a **b** c) + mdMark
      2-4: mdImageSource(src=http://x,alt=a **b** c)
      4-6: mdImageSource(src=http://x,alt=a **b** c) + mdMark + mdStrong
      6-7: mdImageSource(src=http://x,alt=a **b** c) + mdStrong
      7-9: mdImageSource(src=http://x,alt=a **b** c) + mdMark + mdStrong
      9-11: mdImageSource(src=http://x,alt=a **b** c)
      11-13: mdImageSource(src=http://x,alt=a **b** c) + mdMark
      13-21: mdImageSource(src=http://x,alt=a **b** c) + mdLinkUri
      21-22: mdImageSource(src=http://x,alt=a **b** c) + mdImageView(src=http://x,alt=a **b** c) + mdMark
      "
    `)
  })

  it('autolinks a bare https URL', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'visit https://example.com now')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-6: -
      6-25: mdLinkText(href=https://example.com)
      25-29: -
      "
    `)
  })

  it('autolinks a www URL with an implied https scheme', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'see www.example.com here')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-4: -
      4-19: mdLinkText(href=https://www.example.com)
      19-24: -
      "
    `)
  })

  it('autolinks a bare email as mailto', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'mail me@example.com ok')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-5: -
      5-19: mdLinkText(href=mailto:me@example.com)
      19-22: -
      "
    `)
  })

  it('autolinks a bare mailto URL, keeping the scheme', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'a mailto:me@example.com b')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: -
      2-23: mdLinkText(href=mailto:me@example.com)
      23-25: -
      "
    `)
  })

  it('autolinks an angle-bracket URL, with the brackets as mdMark', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'a <https://example.com> b')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: -
      2-3: mdMark
      3-22: mdLinkText(href=https://example.com)
      22-23: mdMark
      23-25: -
      "
    `)
  })

  it('keeps a non-http scheme in an angle autolink', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'a <ftp://example.com> b')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: -
      2-3: mdMark
      3-20: mdLinkText(href=ftp://example.com)
      20-21: mdMark
      21-23: -
      "
    `)
  })

  it('keeps an ssh scheme in an angle autolink', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'a <ssh://example.com> b')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: -
      2-3: mdMark
      3-20: mdLinkText(href=ssh://example.com)
      20-21: mdMark
      21-23: -
      "
    `)
  })

  it('excludes trailing punctuation from an autolink', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'end https://example.com.')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-4: -
      4-23: mdLinkText(href=https://example.com)
      23-24: -
      "
    `)
  })

  it('autolinks a URL nested in emphasis', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '*https://example.com*')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-1: mdEm + mdMark
      1-20: mdEm + mdLinkText(href=https://example.com)
      20-21: mdEm + mdMark
      "
    `)
  })

  it('does not bare-autolink a non-http scheme', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'a ftp://example.com b')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-21: -
      "
    `)
  })

  it('does not autolink a schemeless host', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'a example.com b')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-15: -
      "
    `)
  })

  it('nested emphasis inside strong (***foo***)', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '***foo***')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-1: mdEm + mdMark
      1-3: mdEm + mdMark + mdStrong
      3-6: mdEm + mdStrong
      6-8: mdEm + mdMark + mdStrong
      8-9: mdEm + mdMark
      "
    `)
  })

  it('adjacent emphasis and strong', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '*a***b**')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-1: mdEm + mdMark
      1-2: mdEm
      2-3: mdEm + mdMark
      3-5: mdMark + mdStrong
      5-6: mdStrong
      6-8: mdMark + mdStrong
      "
    `)
  })

  it('emphasis at start and end of text', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '*a* mid *b*')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-1: mdEm + mdMark
      1-2: mdEm
      2-3: mdEm + mdMark
      3-8: -
      8-9: mdEm + mdMark
      9-10: mdEm
      10-11: mdEm + mdMark
      "
    `)
  })

  it('entire content is emphasized', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '*all*')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-1: mdEm + mdMark
      1-4: mdEm
      4-5: mdEm + mdMark
      "
    `)
  })

  it('empty input returns no chunks', () => {
    expect(inlineTextToMarkChunks(markBuilders, '')).toEqual([])
  })

  it('escape characters produce no marks (visible literal text)', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, String.raw`\*not\*`)
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-7: -
      "
    `)
  })

  it('hard break produces no mark', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'a  \nb')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-5: -
      "
    `)
  })

  it('tag yields a single mdTag chunk covering the # too', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'a #meow b')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: -
      2-7: mdTag
      7-9: -
      "
    `)
  })

  it('two tags', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '#a #b')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: mdTag
      2-3: -
      3-5: mdTag
      "
    `)
  })

  it('tag inside emphasis', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '*x #tag y*')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-1: mdEm + mdMark
      1-3: mdEm
      3-7: mdEm + mdTag
      7-9: mdEm
      9-10: mdEm + mdMark
      "
    `)
  })

  it('tag inside a link label', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '[see #tag](http://x)')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-1: mdLinkText(href=http://x) + mdMark
      1-5: mdLinkText(href=http://x)
      5-9: mdLinkText(href=http://x) + mdTag
      9-11: mdMark
      11-19: mdLinkUri
      19-20: mdMark
      "
    `)
  })

  it('heading-like text produces no tag', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '# heading text')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-14: -
      "
    `)
  })

  it('all-digit tag produces no mark', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, "we're #1")
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-8: -
      "
    `)
  })

  it('wikilink yields mdMark brackets around an mdWikilinkSource target', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'a [[note]] b')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: -
      2-4: mdMark + mdWikilinkSource(target=note)
      4-8: mdWikilinkSource(target=note)
      8-10: mdMark + mdWikilinkSource(target=note) + mdWikilinkView(target=note)
      10-12: -
      "
    `)
  })

  it('adjacent wikilinks stay distinct via their target attribute', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '[[a]][[b]]')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: mdMark + mdWikilinkSource(target=a)
      2-3: mdWikilinkSource(target=a)
      3-5: mdMark + mdWikilinkSource(target=a) + mdWikilinkView(target=a)
      5-7: mdMark + mdWikilinkSource(target=b)
      7-8: mdWikilinkSource(target=b)
      8-10: mdMark + mdWikilinkSource(target=b) + mdWikilinkView(target=b)
      "
    `)
  })

  it('wikilink inside emphasis', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '*x [[n]] y*')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-1: mdEm + mdMark
      1-3: mdEm
      3-5: mdEm + mdMark + mdWikilinkSource(target=n)
      5-6: mdEm + mdWikilinkSource(target=n)
      6-8: mdEm + mdMark + mdWikilinkSource(target=n) + mdWikilinkView(target=n)
      8-10: mdEm
      10-11: mdEm + mdMark
      "
    `)
  })

  it('wikilink inside a link label', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '[see [[x]]](http://y)')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-1: mdLinkText(href=http://y) + mdMark
      1-5: mdLinkText(href=http://y)
      5-7: mdLinkText(href=http://y) + mdMark + mdWikilinkSource(target=x)
      7-8: mdLinkText(href=http://y) + mdWikilinkSource(target=x)
      8-10: mdLinkText(href=http://y) + mdMark + mdWikilinkSource(target=x) + mdWikilinkView(target=x)
      10-12: mdMark
      12-20: mdLinkUri
      20-21: mdMark
      "
    `)
  })

  it('no mdTag inside a wikilink target', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '[[note #tag]]')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: mdMark + mdWikilinkSource(target=note #tag)
      2-11: mdWikilinkSource(target=note #tag)
      11-13: mdMark + mdWikilinkSource(target=note #tag) + mdWikilinkView(target=note #tag)
      "
    `)
  })

  it('unclosed wikilink falls back to link parsing of the inner [a]', () => {
    // No mdWikilinkSource anywhere; the inner `[a]` becomes a shortcut
    // reference link (pre-existing lezer behavior).
    const chunks = inlineTextToMarkChunks(markBuilders, '[[a]')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-1: -
      1-2: mdMark
      2-3: -
      3-4: mdMark
      "
    `)
  })
})
