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

function formatMarkChunks(chunks: MarkChunk[]): string {
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
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-11: -
      "
    `)
  })

  it('emphasis yields gap + mark + content + mark', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'Hello *world*')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-6: -
      6-7: mdEm + mdGroup(key=italic) + mdMark
      7-12: mdEm + mdGroup(key=italic)
      12-13: mdEm + mdGroup(key=italic) + mdMark
      "
    `)
  })

  it('strong emphasis', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'a **bold** b')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: -
      2-4: mdGroup(key=bold) + mdMark + mdStrong
      4-8: mdGroup(key=bold) + mdStrong
      8-10: mdGroup(key=bold) + mdMark + mdStrong
      10-12: -
      "
    `)
  })

  it('inline code', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'a `c` b')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: -
      2-3: mdCode + mdGroup(key=code) + mdMark
      3-4: mdCode + mdGroup(key=code)
      4-5: mdCode + mdGroup(key=code) + mdMark
      5-7: -
      "
    `)
  })

  it('strikethrough', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'a ~~b~~ c')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: -
      2-4: mdDel + mdGroup(key=strike) + mdMark
      4-5: mdDel + mdGroup(key=strike)
      5-7: mdDel + mdGroup(key=strike) + mdMark
      7-9: -
      "
    `)
  })

  it('link with href on its text portion', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'see [docs](http://x) now')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-4: -
      4-5: mdGroup(key=link_http://x) + mdLinkText(href=http://x) + mdMark
      5-9: mdGroup(key=link_http://x) + mdLinkText(href=http://x)
      9-11: mdGroup(key=link_http://x) + mdMark
      11-19: mdGroup(key=link_http://x) + mdLinkUri
      19-20: mdGroup(key=link_http://x) + mdMark
      20-24: -
      "
    `)
  })

  it('link with emphasis nested inside the text', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '[*ital*](http://x)')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-1: mdGroup(key=link_http://x) + mdLinkText(href=http://x) + mdMark
      1-2: mdEm + mdGroup(key=link_http://x) + mdLinkText(href=http://x) + mdMark
      2-6: mdEm + mdGroup(key=link_http://x) + mdLinkText(href=http://x)
      6-7: mdEm + mdGroup(key=link_http://x) + mdLinkText(href=http://x) + mdMark
      7-9: mdGroup(key=link_http://x) + mdMark
      9-17: mdGroup(key=link_http://x) + mdLinkUri
      17-18: mdGroup(key=link_http://x) + mdMark
      "
    `)
  })

  it('image: mdImageSource over the source, mdImageView on the final char', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'see ![alt](http://x/p.png) end')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-4: -
      4-6: mdGroup(key=image_http://x/p.png) + mdImageSource(src=http://x/p.png,alt=alt) + mdMark
      6-9: mdGroup(key=image_http://x/p.png) + mdImageSource(src=http://x/p.png,alt=alt)
      9-11: mdGroup(key=image_http://x/p.png) + mdImageSource(src=http://x/p.png,alt=alt) + mdMark
      11-25: mdGroup(key=image_http://x/p.png) + mdImageSource(src=http://x/p.png,alt=alt) + mdLinkUri
      25-26: mdGroup(key=image_http://x/p.png) + mdImageSource(src=http://x/p.png,alt=alt) + mdImageView(src=http://x/p.png,alt=alt) + mdMark
      26-30: -
      "
    `)
  })

  it('image with empty alt', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '![](z.png)')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-4: mdGroup(key=image_z.png) + mdImageSource(src=z.png) + mdMark
      4-9: mdGroup(key=image_z.png) + mdImageSource(src=z.png) + mdLinkUri
      9-10: mdGroup(key=image_z.png) + mdImageSource(src=z.png) + mdImageView(src=z.png) + mdMark
      "
    `)
  })

  it('reference image does not get image marks (falls through to the link walk)', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'a ![b][id] c')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: -
      2-4: mdGroup(key=link_) + mdMark
      4-5: mdGroup(key=link_)
      5-6: mdGroup(key=link_) + mdMark
      6-10: mdGroup(key=link_)
      10-12: -
      "
    `)
  })

  it('image with a title leaves the title node unmarked', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '![a](http://x "t")')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: mdGroup(key=image_http://x) + mdImageSource(src=http://x,alt=a) + mdMark
      2-3: mdGroup(key=image_http://x) + mdImageSource(src=http://x,alt=a)
      3-5: mdGroup(key=image_http://x) + mdImageSource(src=http://x,alt=a) + mdMark
      5-13: mdGroup(key=image_http://x) + mdImageSource(src=http://x,alt=a) + mdLinkUri
      13-17: mdGroup(key=image_http://x) + mdImageSource(src=http://x,alt=a)
      17-18: mdGroup(key=image_http://x) + mdImageSource(src=http://x,alt=a) + mdImageView(src=http://x,alt=a) + mdMark
      "
    `)
  })

  it('image with formatted alt marks the nested emphasis', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '![a **b** c](http://x)')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: mdGroup(key=image_http://x) + mdImageSource(src=http://x,alt=a **b** c) + mdMark
      2-4: mdGroup(key=image_http://x) + mdImageSource(src=http://x,alt=a **b** c)
      4-6: mdGroup(key=image_http://x) + mdImageSource(src=http://x,alt=a **b** c) + mdMark + mdStrong
      6-7: mdGroup(key=image_http://x) + mdImageSource(src=http://x,alt=a **b** c) + mdStrong
      7-9: mdGroup(key=image_http://x) + mdImageSource(src=http://x,alt=a **b** c) + mdMark + mdStrong
      9-11: mdGroup(key=image_http://x) + mdImageSource(src=http://x,alt=a **b** c)
      11-13: mdGroup(key=image_http://x) + mdImageSource(src=http://x,alt=a **b** c) + mdMark
      13-21: mdGroup(key=image_http://x) + mdImageSource(src=http://x,alt=a **b** c) + mdLinkUri
      21-22: mdGroup(key=image_http://x) + mdImageSource(src=http://x,alt=a **b** c) + mdImageView(src=http://x,alt=a **b** c) + mdMark
      "
    `)
  })

  it('autolinks a bare https URL', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'visit https://example.com now')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-6: -
      6-25: mdLinkText(href=https://example.com)
      25-29: -
      "
    `)
  })

  it('autolinks a www URL with an implied https scheme', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'see www.example.com here')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-4: -
      4-19: mdLinkText(href=https://www.example.com)
      19-24: -
      "
    `)
  })

  it('autolinks a bare email as mailto', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'mail me@example.com ok')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-5: -
      5-19: mdLinkText(href=mailto:me@example.com)
      19-22: -
      "
    `)
  })

  it('autolinks a bare mailto URL, keeping the scheme', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'a mailto:me@example.com b')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: -
      2-23: mdLinkText(href=mailto:me@example.com)
      23-25: -
      "
    `)
  })

  it('autolinks an angle-bracket URL, with the brackets as mdMark', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'a <https://example.com> b')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: -
      2-3: mdGroup(key=autolink) + mdMark
      3-22: mdGroup(key=autolink) + mdLinkText(href=https://example.com)
      22-23: mdGroup(key=autolink) + mdMark
      23-25: -
      "
    `)
  })

  it('keeps a non-http scheme in an angle autolink', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'a <ftp://example.com> b')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: -
      2-3: mdGroup(key=autolink) + mdMark
      3-20: mdGroup(key=autolink) + mdLinkText(href=ftp://example.com)
      20-21: mdGroup(key=autolink) + mdMark
      21-23: -
      "
    `)
  })

  it('keeps an ssh scheme in an angle autolink', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'a <ssh://example.com> b')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: -
      2-3: mdGroup(key=autolink) + mdMark
      3-20: mdGroup(key=autolink) + mdLinkText(href=ssh://example.com)
      20-21: mdGroup(key=autolink) + mdMark
      21-23: -
      "
    `)
  })

  it('excludes trailing punctuation from an autolink', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'end https://example.com.')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-4: -
      4-23: mdLinkText(href=https://example.com)
      23-24: -
      "
    `)
  })

  it('autolinks a URL nested in emphasis', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '*https://example.com*')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-1: mdEm + mdGroup(key=italic) + mdMark
      1-20: mdEm + mdGroup(key=italic) + mdLinkText(href=https://example.com)
      20-21: mdEm + mdGroup(key=italic) + mdMark
      "
    `)
  })

  it('does not bare-autolink a non-http scheme', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'a ftp://example.com b')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-21: -
      "
    `)
  })

  it('autolinks a bare domain on the curated TLD list', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'a example.com b')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: -
      2-13: mdLinkText(href=https://example.com)
      13-15: -
      "
    `)
  })

  it('does not autolink a bare host whose TLD is off the list', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'a README.md b')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-13: -
      "
    `)
  })

  it('bare-autolinks a domain that starts the text', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'google.com')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-10: mdLinkText(href=https://google.com)
      "
    `)
  })

  it('bare-autolinks a domain with a path, keeping the path in the href', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'sub.domain.com/path?q=1')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-23: mdLinkText(href=https://sub.domain.com/path?q=1)
      "
    `)
  })

  it('preserves case in the bare-autolink href', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'GOOGLE.COM')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-10: mdLinkText(href=https://GOOGLE.COM)
      "
    `)
  })

  it('excludes a trailing period from a bare autolink', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'Visit google.com.')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-6: -
      6-16: mdLinkText(href=https://google.com)
      16-17: -
      "
    `)
  })

  it('does not bare-autolink a code-file name', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'edit node.js then')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-17: -
      "
    `)
  })

  it('claims a www. autolink as one chunk, not a nested bare domain', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'www.example.com')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-15: mdLinkText(href=https://www.example.com)
      "
    `)
  })

  it('does not bare-autolink the label of an explicit link', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '[google.com](http://x)')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-1: mdGroup(key=link_http://x) + mdLinkText(href=http://x) + mdMark
      1-11: mdGroup(key=link_http://x) + mdLinkText(href=http://x)
      11-13: mdGroup(key=link_http://x) + mdMark
      13-21: mdGroup(key=link_http://x) + mdLinkUri
      21-22: mdGroup(key=link_http://x) + mdMark
      "
    `)
  })

  it('does not bare-autolink inside inline code', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '`see google.com`')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-1: mdCode + mdGroup(key=code) + mdMark
      1-15: mdCode + mdGroup(key=code)
      15-16: mdCode + mdGroup(key=code) + mdMark
      "
    `)
  })

  it('does not bare-autolink a domain after an @ (it is an email)', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'mail a@google.com here')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-5: -
      5-17: mdLinkText(href=mailto:a@google.com)
      17-22: -
      "
    `)
  })

  it('nested emphasis inside strong (***foo***)', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '***foo***')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-1: mdEm + mdGroup(key=italic) + mdMark
      1-3: mdEm + mdGroup(key=bold) + mdGroup(key=italic) + mdMark + mdStrong
      3-6: mdEm + mdGroup(key=bold) + mdGroup(key=italic) + mdStrong
      6-8: mdEm + mdGroup(key=bold) + mdGroup(key=italic) + mdMark + mdStrong
      8-9: mdEm + mdGroup(key=italic) + mdMark
      "
    `)
  })

  it('adjacent emphasis and strong', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '*a***b**')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-1: mdEm + mdGroup(key=italic) + mdMark
      1-2: mdEm + mdGroup(key=italic)
      2-3: mdEm + mdGroup(key=italic) + mdMark
      3-5: mdGroup(key=bold) + mdMark + mdStrong
      5-6: mdGroup(key=bold) + mdStrong
      6-8: mdGroup(key=bold) + mdMark + mdStrong
      "
    `)
  })

  it('emphasis at start and end of text', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '*a* mid *b*')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-1: mdEm + mdGroup(key=italic) + mdMark
      1-2: mdEm + mdGroup(key=italic)
      2-3: mdEm + mdGroup(key=italic) + mdMark
      3-8: -
      8-9: mdEm + mdGroup(key=italic) + mdMark
      9-10: mdEm + mdGroup(key=italic)
      10-11: mdEm + mdGroup(key=italic) + mdMark
      "
    `)
  })

  it('entire content is emphasized', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '*all*')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-1: mdEm + mdGroup(key=italic) + mdMark
      1-4: mdEm + mdGroup(key=italic)
      4-5: mdEm + mdGroup(key=italic) + mdMark
      "
    `)
  })

  it('empty input returns no chunks', () => {
    expect(inlineTextToMarkChunks(markBuilders, '')).toEqual([])
  })

  it('escape characters produce no marks (visible literal text)', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, String.raw`\*not\*`)
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-7: -
      "
    `)
  })

  it('hard break produces no mark', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'a  \nb')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-5: -
      "
    `)
  })

  it('tag yields a single mdTag chunk covering the # too', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'a #meow b')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: -
      2-7: mdTag
      7-9: -
      "
    `)
  })

  it('two tags', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '#a #b')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: mdTag
      2-3: -
      3-5: mdTag
      "
    `)
  })

  it('tag inside emphasis', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '*x #tag y*')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-1: mdEm + mdGroup(key=italic) + mdMark
      1-3: mdEm + mdGroup(key=italic)
      3-7: mdEm + mdGroup(key=italic) + mdTag
      7-9: mdEm + mdGroup(key=italic)
      9-10: mdEm + mdGroup(key=italic) + mdMark
      "
    `)
  })

  it('tag inside a link label', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '[see #tag](http://x)')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-1: mdGroup(key=link_http://x) + mdLinkText(href=http://x) + mdMark
      1-5: mdGroup(key=link_http://x) + mdLinkText(href=http://x)
      5-9: mdGroup(key=link_http://x) + mdLinkText(href=http://x) + mdTag
      9-11: mdGroup(key=link_http://x) + mdMark
      11-19: mdGroup(key=link_http://x) + mdLinkUri
      19-20: mdGroup(key=link_http://x) + mdMark
      "
    `)
  })

  it('heading-like text produces no tag', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '# heading text')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-14: -
      "
    `)
  })

  it('all-digit tag produces no mark', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, "we're #1")
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-8: -
      "
    `)
  })

  it('wikilink yields mdMark brackets around an mdWikilinkSource target', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, 'a [[note]] b')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: -
      2-4: mdMark + mdWikilinkSource(target=note)
      4-8: mdWikilinkSource(target=note)
      8-9: mdMark + mdWikilinkSource(target=note)
      9-10: mdMark + mdWikilinkSource(target=note) + mdWikilinkView(target=note)
      10-12: -
      "
    `)
  })

  it('adjacent wikilinks stay distinct via their target attribute', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '[[a]][[b]]')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: mdMark + mdWikilinkSource(target=a)
      2-3: mdWikilinkSource(target=a)
      3-4: mdMark + mdWikilinkSource(target=a)
      4-5: mdMark + mdWikilinkSource(target=a) + mdWikilinkView(target=a)
      5-7: mdMark + mdWikilinkSource(target=b)
      7-8: mdWikilinkSource(target=b)
      8-9: mdMark + mdWikilinkSource(target=b)
      9-10: mdMark + mdWikilinkSource(target=b) + mdWikilinkView(target=b)
      "
    `)
  })

  it('wikilink inside emphasis', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '*x [[n]] y*')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-1: mdEm + mdGroup(key=italic) + mdMark
      1-3: mdEm + mdGroup(key=italic)
      3-5: mdEm + mdGroup(key=italic) + mdMark + mdWikilinkSource(target=n)
      5-6: mdEm + mdGroup(key=italic) + mdWikilinkSource(target=n)
      6-7: mdEm + mdGroup(key=italic) + mdMark + mdWikilinkSource(target=n)
      7-8: mdEm + mdGroup(key=italic) + mdMark + mdWikilinkSource(target=n) + mdWikilinkView(target=n)
      8-10: mdEm + mdGroup(key=italic)
      10-11: mdEm + mdGroup(key=italic) + mdMark
      "
    `)
  })

  it('wikilink inside a link label', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '[see [[x]]](http://y)')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-1: mdGroup(key=link_http://y) + mdLinkText(href=http://y) + mdMark
      1-5: mdGroup(key=link_http://y) + mdLinkText(href=http://y)
      5-7: mdGroup(key=link_http://y) + mdLinkText(href=http://y) + mdMark + mdWikilinkSource(target=x)
      7-8: mdGroup(key=link_http://y) + mdLinkText(href=http://y) + mdWikilinkSource(target=x)
      8-9: mdGroup(key=link_http://y) + mdLinkText(href=http://y) + mdMark + mdWikilinkSource(target=x)
      9-10: mdGroup(key=link_http://y) + mdLinkText(href=http://y) + mdMark + mdWikilinkSource(target=x) + mdWikilinkView(target=x)
      10-12: mdGroup(key=link_http://y) + mdMark
      12-20: mdGroup(key=link_http://y) + mdLinkUri
      20-21: mdGroup(key=link_http://y) + mdMark
      "
    `)
  })

  it('no mdTag inside a wikilink target', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '[[note #tag]]')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: mdMark + mdWikilinkSource(target=note #tag)
      2-11: mdWikilinkSource(target=note #tag)
      11-12: mdMark + mdWikilinkSource(target=note #tag)
      12-13: mdMark + mdWikilinkSource(target=note #tag) + mdWikilinkView(target=note #tag)
      "
    `)
  })

  it('unclosed wikilink falls back to link parsing of the inner [a]', () => {
    // No mdWikilinkSource anywhere; the inner `[a]` becomes a shortcut
    // reference link (pre-existing lezer behavior).
    const chunks = inlineTextToMarkChunks(markBuilders, '[[a]')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-1: -
      1-2: mdGroup(key=link_) + mdMark
      2-3: mdGroup(key=link_)
      3-4: mdGroup(key=link_) + mdMark
      "
    `)
  })

  it('nested bold>italic carries both group keys, inner text in both', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '**bold *italic* bold**')
    // The `italic` run carries mdGroup(key=bold) AND mdGroup(key=italic); the
    // bold-only runs carry only mdGroup(key=bold).
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: mdGroup(key=bold) + mdMark + mdStrong
      2-7: mdGroup(key=bold) + mdStrong
      7-8: mdEm + mdGroup(key=bold) + mdGroup(key=italic) + mdMark + mdStrong
      8-14: mdEm + mdGroup(key=bold) + mdGroup(key=italic) + mdStrong
      14-15: mdEm + mdGroup(key=bold) + mdGroup(key=italic) + mdMark + mdStrong
      15-20: mdGroup(key=bold) + mdStrong
      20-22: mdGroup(key=bold) + mdMark + mdStrong
      "
    `)
  })

  it('adjacent links to different urls get distinct group keys', () => {
    const chunks = inlineTextToMarkChunks(markBuilders, '[a](x)[b](y)')
    expect(formatMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-1: mdGroup(key=link_x) + mdLinkText(href=x) + mdMark
      1-2: mdGroup(key=link_x) + mdLinkText(href=x)
      2-4: mdGroup(key=link_x) + mdMark
      4-5: mdGroup(key=link_x) + mdLinkUri
      5-6: mdGroup(key=link_x) + mdMark
      6-7: mdGroup(key=link_y) + mdLinkText(href=y) + mdMark
      7-8: mdGroup(key=link_y) + mdLinkText(href=y)
      8-10: mdGroup(key=link_y) + mdMark
      10-11: mdGroup(key=link_y) + mdLinkUri
      11-12: mdGroup(key=link_y) + mdMark
      "
    `)
  })

  it('wikilink, tag, and bare autolink carry no group', () => {
    for (const text of ['see [[note]] end', 'hello #tag world', 'visit https://example.com now']) {
      expect(formatMarkChunks(inlineTextToMarkChunks(markBuilders, text))).not.toContain('mdGroup')
    }
  })
})
