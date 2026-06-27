import { createMarkBuilders } from '@prosekit/core'
import { describe, expect, it } from 'vitest'

import { once } from '@ocavue/utils'
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
      const attrStr = filtered
        .map((k) => {
          const value = attrs[k]
          const rendered = typeof value === 'object' ? JSON.stringify(value) : (value as string)
          return `${k}=${rendered}`
        })
        .join(',')
      return `${mark.type.name}(${attrStr})`
    })
    .join(' + ')
  return `[${from}-${to}]: ${names || '-'}`
}

const getMarkBuilders = once((): TypedMarkBuilders => {
  const schema = defineEditorExtension().schema!
  return createMarkBuilders<EditorExtension>(schema)
})

function parse(text: string): string {
  const markBuilders = getMarkBuilders()
  const chunks = inlineTextToMarkChunks(markBuilders, text)
  return '\n' + chunks.map(formatMarkChunk).join('\n') + '\n'
}

describe('inlineTextToMarkChunks', () => {
  it('plain text returns no chunks (no marks anywhere)', () => {
    expect(parse('hello world')).toMatchInlineSnapshot(`
      "
      0-11: -
      "
    `)
  })

  it('emphasis yields gap + mark + content + mark', () => {
    expect(parse('Hello *world*')).toMatchInlineSnapshot(`
      "
      0-6: -
      6-7: mdEm + mdMark + mdPack(key=italic)
      7-12: mdEm + mdPack(key=italic)
      12-13: mdEm + mdMark + mdPack(key=italic)
      "
    `)
  })

  it('strong emphasis', () => {
    expect(parse('a **bold** b')).toMatchInlineSnapshot(`
      "
      0-2: -
      2-4: mdMark + mdPack(key=bold) + mdStrong
      4-8: mdPack(key=bold) + mdStrong
      8-10: mdMark + mdPack(key=bold) + mdStrong
      10-12: -
      "
    `)
  })

  it('inline code', () => {
    expect(parse('a `c` b')).toMatchInlineSnapshot(`
      "
      0-2: -
      2-3: mdCode + mdMark + mdPack(key=code)
      3-4: mdCode + mdPack(key=code)
      4-5: mdCode + mdMark + mdPack(key=code)
      5-7: -
      "
    `)
  })

  it('strikethrough', () => {
    expect(parse('a ~~b~~ c')).toMatchInlineSnapshot(`
      "
      0-2: -
      2-4: mdDel + mdMark + mdPack(key=strike)
      4-5: mdDel + mdPack(key=strike)
      5-7: mdDel + mdMark + mdPack(key=strike)
      7-9: -
      "
    `)
  })

  it('link with href on its text portion', () => {
    expect(parse('see [docs](http://x) now')).toMatchInlineSnapshot(`
      "
      0-4: -
      4-5: mdLinkText(href=http://x) + mdMark + mdPack(key=link,data={"href":"http://x","title":""})
      5-9: mdLinkText(href=http://x) + mdPack(key=link,data={"href":"http://x","title":""})
      9-11: mdMark + mdPack(key=link,data={"href":"http://x","title":""})
      11-19: mdLinkUri + mdPack(key=link,data={"href":"http://x","title":""})
      19-20: mdMark + mdPack(key=link,data={"href":"http://x","title":""})
      20-24: -
      "
    `)
  })

  it('link with a title marks the title with mdLinkTitle', () => {
    expect(parse('[docs](http://x "t")')).toMatchInlineSnapshot(`
      "
      0-1: mdLinkText(href=http://x) + mdMark + mdPack(key=link,data={"href":"http://x","title":"t"})
      1-5: mdLinkText(href=http://x) + mdPack(key=link,data={"href":"http://x","title":"t"})
      5-7: mdMark + mdPack(key=link,data={"href":"http://x","title":"t"})
      7-15: mdLinkUri + mdPack(key=link,data={"href":"http://x","title":"t"})
      15-16: mdPack(key=link,data={"href":"http://x","title":"t"})
      16-19: mdLinkTitle + mdPack(key=link,data={"href":"http://x","title":"t"})
      19-20: mdMark + mdPack(key=link,data={"href":"http://x","title":"t"})
      "
    `)
  })

  it('link with emphasis nested inside the text', () => {
    expect(parse('[*ital*](http://x)')).toMatchInlineSnapshot(`
      "
      0-1: mdLinkText(href=http://x) + mdMark + mdPack(key=link,data={"href":"http://x","title":""})
      1-2: mdEm + mdLinkText(href=http://x) + mdMark + mdPack(key=link,data={"href":"http://x","title":""})
      2-6: mdEm + mdLinkText(href=http://x) + mdPack(key=link,data={"href":"http://x","title":""})
      6-7: mdEm + mdLinkText(href=http://x) + mdMark + mdPack(key=link,data={"href":"http://x","title":""})
      7-9: mdMark + mdPack(key=link,data={"href":"http://x","title":""})
      9-17: mdLinkUri + mdPack(key=link,data={"href":"http://x","title":""})
      17-18: mdMark + mdPack(key=link,data={"href":"http://x","title":""})
      "
    `)
  })

  it('image: mdImageSource over the source, mdImageView on the final char', () => {
    expect(parse('see ![alt](http://x/p.png) end')).toMatchInlineSnapshot(`
      "
      0-4: -
      4-6: mdImageSource(src=http://x/p.png,alt=alt) + mdMark + mdPack(key=image,data={"src":"http://x/p.png"})
      6-9: mdImageSource(src=http://x/p.png,alt=alt) + mdPack(key=image,data={"src":"http://x/p.png"})
      9-11: mdImageSource(src=http://x/p.png,alt=alt) + mdMark + mdPack(key=image,data={"src":"http://x/p.png"})
      11-25: mdImageSource(src=http://x/p.png,alt=alt) + mdLinkUri + mdPack(key=image,data={"src":"http://x/p.png"})
      25-26: mdImageSource(src=http://x/p.png,alt=alt) + mdImageView(src=http://x/p.png,alt=alt) + mdMark + mdPack(key=image,data={"src":"http://x/p.png"})
      26-30: -
      "
    `)
  })

  it('image with empty alt', () => {
    expect(parse('![](z.png)')).toMatchInlineSnapshot(`
      "
      0-4: mdImageSource(src=z.png) + mdMark + mdPack(key=image,data={"src":"z.png"})
      4-9: mdImageSource(src=z.png) + mdLinkUri + mdPack(key=image,data={"src":"z.png"})
      9-10: mdImageSource(src=z.png) + mdImageView(src=z.png) + mdMark + mdPack(key=image,data={"src":"z.png"})
      "
    `)
  })

  it('reference image does not get image marks (falls through to the link walk)', () => {
    expect(parse('a ![b][id] c')).toMatchInlineSnapshot(`
      "
      0-2: -
      2-4: mdMark + mdPack(key=link,data={"href":"","title":""})
      4-5: mdPack(key=link,data={"href":"","title":""})
      5-6: mdMark + mdPack(key=link,data={"href":"","title":""})
      6-10: mdPack(key=link,data={"href":"","title":""})
      10-12: -
      "
    `)
  })

  it('image with a title marks the title node like a link title', () => {
    expect(parse('![a](http://x "t")')).toMatchInlineSnapshot(`
      "
      0-2: mdImageSource(src=http://x,alt=a) + mdMark + mdPack(key=image,data={"src":"http://x"})
      2-3: mdImageSource(src=http://x,alt=a) + mdPack(key=image,data={"src":"http://x"})
      3-5: mdImageSource(src=http://x,alt=a) + mdMark + mdPack(key=image,data={"src":"http://x"})
      5-13: mdImageSource(src=http://x,alt=a) + mdLinkUri + mdPack(key=image,data={"src":"http://x"})
      13-14: mdImageSource(src=http://x,alt=a) + mdPack(key=image,data={"src":"http://x"})
      14-17: mdImageSource(src=http://x,alt=a) + mdLinkTitle + mdPack(key=image,data={"src":"http://x"})
      17-18: mdImageSource(src=http://x,alt=a) + mdImageView(src=http://x,alt=a) + mdMark + mdPack(key=image,data={"src":"http://x"})
      "
    `)
  })

  it('image with formatted alt marks the nested emphasis', () => {
    expect(parse('![a **b** c](http://x)')).toMatchInlineSnapshot(`
      "
      0-2: mdImageSource(src=http://x,alt=a **b** c) + mdMark + mdPack(key=image,data={"src":"http://x"})
      2-4: mdImageSource(src=http://x,alt=a **b** c) + mdPack(key=image,data={"src":"http://x"})
      4-6: mdImageSource(src=http://x,alt=a **b** c) + mdMark + mdPack(key=image,data={"src":"http://x"}) + mdStrong
      6-7: mdImageSource(src=http://x,alt=a **b** c) + mdPack(key=image,data={"src":"http://x"}) + mdStrong
      7-9: mdImageSource(src=http://x,alt=a **b** c) + mdMark + mdPack(key=image,data={"src":"http://x"}) + mdStrong
      9-11: mdImageSource(src=http://x,alt=a **b** c) + mdPack(key=image,data={"src":"http://x"})
      11-13: mdImageSource(src=http://x,alt=a **b** c) + mdMark + mdPack(key=image,data={"src":"http://x"})
      13-21: mdImageSource(src=http://x,alt=a **b** c) + mdLinkUri + mdPack(key=image,data={"src":"http://x"})
      21-22: mdImageSource(src=http://x,alt=a **b** c) + mdImageView(src=http://x,alt=a **b** c) + mdMark + mdPack(key=image,data={"src":"http://x"})
      "
    `)
  })

  it('autolinks a bare https URL', () => {
    expect(parse('visit https://example.com now')).toMatchInlineSnapshot(`
      "
      0-6: -
      6-25: mdLinkText(href=https://example.com)
      25-29: -
      "
    `)
  })

  it('autolinks a www URL with an implied https scheme', () => {
    expect(parse('see www.example.com here')).toMatchInlineSnapshot(`
      "
      0-4: -
      4-19: mdLinkText(href=https://www.example.com)
      19-24: -
      "
    `)
  })

  it('autolinks a bare email as mailto', () => {
    expect(parse('mail me@example.com ok')).toMatchInlineSnapshot(`
      "
      0-5: -
      5-19: mdLinkText(href=mailto:me@example.com)
      19-22: -
      "
    `)
  })

  it('autolinks a bare mailto URL, keeping the scheme', () => {
    expect(parse('a mailto:me@example.com b')).toMatchInlineSnapshot(`
      "
      0-2: -
      2-23: mdLinkText(href=mailto:me@example.com)
      23-25: -
      "
    `)
  })

  it('autolinks an angle-bracket URL, with the brackets as mdMark', () => {
    expect(parse('a <https://example.com> b')).toMatchInlineSnapshot(`
      "
      0-2: -
      2-3: mdMark + mdPack(key=autolink)
      3-22: mdLinkText(href=https://example.com) + mdPack(key=autolink)
      22-23: mdMark + mdPack(key=autolink)
      23-25: -
      "
    `)
  })

  it('keeps a non-http scheme in an angle autolink', () => {
    expect(parse('a <ftp://example.com> b')).toMatchInlineSnapshot(`
      "
      0-2: -
      2-3: mdMark + mdPack(key=autolink)
      3-20: mdLinkText(href=ftp://example.com) + mdPack(key=autolink)
      20-21: mdMark + mdPack(key=autolink)
      21-23: -
      "
    `)
  })

  it('keeps an ssh scheme in an angle autolink', () => {
    expect(parse('a <ssh://example.com> b')).toMatchInlineSnapshot(`
      "
      0-2: -
      2-3: mdMark + mdPack(key=autolink)
      3-20: mdLinkText(href=ssh://example.com) + mdPack(key=autolink)
      20-21: mdMark + mdPack(key=autolink)
      21-23: -
      "
    `)
  })

  it('excludes trailing punctuation from an autolink', () => {
    expect(parse('end https://example.com.')).toMatchInlineSnapshot(`
      "
      0-4: -
      4-23: mdLinkText(href=https://example.com)
      23-24: -
      "
    `)
  })

  it('autolinks a URL nested in emphasis', () => {
    expect(parse('*https://example.com*')).toMatchInlineSnapshot(`
      "
      0-1: mdEm + mdMark + mdPack(key=italic)
      1-20: mdEm + mdLinkText(href=https://example.com) + mdPack(key=italic)
      20-21: mdEm + mdMark + mdPack(key=italic)
      "
    `)
  })

  it('does not bare-autolink a non-http scheme', () => {
    expect(parse('a ftp://example.com b')).toMatchInlineSnapshot(`
      "
      0-21: -
      "
    `)
  })

  it('autolinks a bare domain on the curated TLD list', () => {
    expect(parse('a example.com b')).toMatchInlineSnapshot(`
      "
      0-2: -
      2-13: mdLinkText(href=https://example.com)
      13-15: -
      "
    `)
  })

  it('does not autolink a bare host whose TLD is off the list', () => {
    expect(parse('a README.md b')).toMatchInlineSnapshot(`
      "
      0-13: -
      "
    `)
  })

  it('bare-autolinks a domain that starts the text', () => {
    expect(parse('google.com')).toMatchInlineSnapshot(`
      "
      0-10: mdLinkText(href=https://google.com)
      "
    `)
  })

  it('bare-autolinks a domain with a path, keeping the path in the href', () => {
    expect(parse('sub.domain.com/path?q=1')).toMatchInlineSnapshot(`
      "
      0-23: mdLinkText(href=https://sub.domain.com/path?q=1)
      "
    `)
  })

  it('preserves case in the bare-autolink href', () => {
    expect(parse('GOOGLE.COM')).toMatchInlineSnapshot(`
      "
      0-10: mdLinkText(href=https://GOOGLE.COM)
      "
    `)
  })

  it('excludes a trailing period from a bare autolink', () => {
    expect(parse('Visit google.com.')).toMatchInlineSnapshot(`
      "
      0-6: -
      6-16: mdLinkText(href=https://google.com)
      16-17: -
      "
    `)
  })

  it('does not bare-autolink a code-file name', () => {
    expect(parse('edit node.js then')).toMatchInlineSnapshot(`
      "
      0-17: -
      "
    `)
  })

  it('claims a www. autolink as one chunk, not a nested bare domain', () => {
    expect(parse('www.example.com')).toMatchInlineSnapshot(`
      "
      0-15: mdLinkText(href=https://www.example.com)
      "
    `)
  })

  it('does not bare-autolink the label of an explicit link', () => {
    expect(parse('[google.com](http://x)')).toMatchInlineSnapshot(`
      "
      0-1: mdLinkText(href=http://x) + mdMark + mdPack(key=link,data={"href":"http://x","title":""})
      1-11: mdLinkText(href=http://x) + mdPack(key=link,data={"href":"http://x","title":""})
      11-13: mdMark + mdPack(key=link,data={"href":"http://x","title":""})
      13-21: mdLinkUri + mdPack(key=link,data={"href":"http://x","title":""})
      21-22: mdMark + mdPack(key=link,data={"href":"http://x","title":""})
      "
    `)
  })

  it('does not bare-autolink inside inline code', () => {
    expect(parse('`see google.com`')).toMatchInlineSnapshot(`
      "
      0-1: mdCode + mdMark + mdPack(key=code)
      1-15: mdCode + mdPack(key=code)
      15-16: mdCode + mdMark + mdPack(key=code)
      "
    `)
  })

  it('does not bare-autolink a domain after an @ (it is an email)', () => {
    expect(parse('mail a@google.com here')).toMatchInlineSnapshot(`
      "
      0-5: -
      5-17: mdLinkText(href=mailto:a@google.com)
      17-22: -
      "
    `)
  })

  it('nested emphasis inside strong (***foo***)', () => {
    expect(parse('***foo***')).toMatchInlineSnapshot(`
      "
      0-1: mdEm + mdMark + mdPack(key=italic)
      1-3: mdEm + mdMark + mdPack(key=bold) + mdPack(key=italic) + mdStrong
      3-6: mdEm + mdPack(key=bold) + mdPack(key=italic) + mdStrong
      6-8: mdEm + mdMark + mdPack(key=bold) + mdPack(key=italic) + mdStrong
      8-9: mdEm + mdMark + mdPack(key=italic)
      "
    `)
  })

  it('adjacent emphasis and strong', () => {
    expect(parse('*a***b**')).toMatchInlineSnapshot(`
      "
      0-1: mdEm + mdMark + mdPack(key=italic)
      1-2: mdEm + mdPack(key=italic)
      2-3: mdEm + mdMark + mdPack(key=italic)
      3-5: mdMark + mdPack(key=bold) + mdStrong
      5-6: mdPack(key=bold) + mdStrong
      6-8: mdMark + mdPack(key=bold) + mdStrong
      "
    `)
  })

  it('emphasis at start and end of text', () => {
    expect(parse('*a* mid *b*')).toMatchInlineSnapshot(`
      "
      0-1: mdEm + mdMark + mdPack(key=italic)
      1-2: mdEm + mdPack(key=italic)
      2-3: mdEm + mdMark + mdPack(key=italic)
      3-8: -
      8-9: mdEm + mdMark + mdPack(key=italic)
      9-10: mdEm + mdPack(key=italic)
      10-11: mdEm + mdMark + mdPack(key=italic)
      "
    `)
  })

  it('entire content is emphasized', () => {
    expect(parse('*all*')).toMatchInlineSnapshot(`
      "
      0-1: mdEm + mdMark + mdPack(key=italic)
      1-4: mdEm + mdPack(key=italic)
      4-5: mdEm + mdMark + mdPack(key=italic)
      "
    `)
  })

  it('empty input returns no chunks', () => {
    expect(parse('')).toMatchInlineSnapshot(`
      "

      "
    `)
  })

  it('escape characters produce no marks (visible literal text)', () => {
    expect(parse(String.raw`\*not\*`)).toMatchInlineSnapshot(`
      "
      0-7: -
      "
    `)
  })

  it('hard break produces no mark', () => {
    expect(parse('a  \nb')).toMatchInlineSnapshot(`
      "
      0-5: -
      "
    `)
  })

  it('tag yields a single mdTag chunk covering the # too', () => {
    expect(parse('a #meow b')).toMatchInlineSnapshot(`
      "
      0-2: -
      2-7: mdTag
      7-9: -
      "
    `)
  })

  it('two tags', () => {
    expect(parse('#a #b')).toMatchInlineSnapshot(`
      "
      0-2: mdTag
      2-3: -
      3-5: mdTag
      "
    `)
  })

  it('tag inside emphasis', () => {
    expect(parse('*x #tag y*')).toMatchInlineSnapshot(`
      "
      0-1: mdEm + mdMark + mdPack(key=italic)
      1-3: mdEm + mdPack(key=italic)
      3-7: mdEm + mdPack(key=italic) + mdTag
      7-9: mdEm + mdPack(key=italic)
      9-10: mdEm + mdMark + mdPack(key=italic)
      "
    `)
  })

  it('tag inside a link label', () => {
    expect(parse('[see #tag](http://x)')).toMatchInlineSnapshot(`
      "
      0-1: mdLinkText(href=http://x) + mdMark + mdPack(key=link,data={"href":"http://x","title":""})
      1-5: mdLinkText(href=http://x) + mdPack(key=link,data={"href":"http://x","title":""})
      5-9: mdLinkText(href=http://x) + mdPack(key=link,data={"href":"http://x","title":""}) + mdTag
      9-11: mdMark + mdPack(key=link,data={"href":"http://x","title":""})
      11-19: mdLinkUri + mdPack(key=link,data={"href":"http://x","title":""})
      19-20: mdMark + mdPack(key=link,data={"href":"http://x","title":""})
      "
    `)
  })

  it('heading-like text produces no tag', () => {
    expect(parse('# heading text')).toMatchInlineSnapshot(`
      "
      0-14: -
      "
    `)
  })

  it('all-digit tag produces no mark', () => {
    expect(parse("we're #1")).toMatchInlineSnapshot(`
      "
      0-8: -
      "
    `)
  })

  it('wikilink yields mdMark brackets around an mdWikilinkSource target', () => {
    expect(parse('a [[note]] b')).toMatchInlineSnapshot(`
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
    expect(parse('[[a]][[b]]')).toMatchInlineSnapshot(`
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
    expect(parse('*x [[n]] y*')).toMatchInlineSnapshot(`
      "
      0-1: mdEm + mdMark + mdPack(key=italic)
      1-3: mdEm + mdPack(key=italic)
      3-5: mdEm + mdMark + mdPack(key=italic) + mdWikilinkSource(target=n)
      5-6: mdEm + mdPack(key=italic) + mdWikilinkSource(target=n)
      6-7: mdEm + mdMark + mdPack(key=italic) + mdWikilinkSource(target=n)
      7-8: mdEm + mdMark + mdPack(key=italic) + mdWikilinkSource(target=n) + mdWikilinkView(target=n)
      8-10: mdEm + mdPack(key=italic)
      10-11: mdEm + mdMark + mdPack(key=italic)
      "
    `)
  })

  it('wikilink inside a link label', () => {
    expect(parse('[see [[x]]](http://y)')).toMatchInlineSnapshot(`
      "
      0-1: mdLinkText(href=http://y) + mdMark + mdPack(key=link,data={"href":"http://y","title":""})
      1-5: mdLinkText(href=http://y) + mdPack(key=link,data={"href":"http://y","title":""})
      5-7: mdLinkText(href=http://y) + mdMark + mdPack(key=link,data={"href":"http://y","title":""}) + mdWikilinkSource(target=x)
      7-8: mdLinkText(href=http://y) + mdPack(key=link,data={"href":"http://y","title":""}) + mdWikilinkSource(target=x)
      8-9: mdLinkText(href=http://y) + mdMark + mdPack(key=link,data={"href":"http://y","title":""}) + mdWikilinkSource(target=x)
      9-10: mdLinkText(href=http://y) + mdMark + mdPack(key=link,data={"href":"http://y","title":""}) + mdWikilinkSource(target=x) + mdWikilinkView(target=x)
      10-12: mdMark + mdPack(key=link,data={"href":"http://y","title":""})
      12-20: mdLinkUri + mdPack(key=link,data={"href":"http://y","title":""})
      20-21: mdMark + mdPack(key=link,data={"href":"http://y","title":""})
      "
    `)
  })

  it('no mdTag inside a wikilink target', () => {
    expect(parse('[[note #tag]]')).toMatchInlineSnapshot(`
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
    expect(parse('[[a]')).toMatchInlineSnapshot(`
      "
      0-1: -
      1-2: mdMark + mdPack(key=link,data={"href":"","title":""})
      2-3: mdPack(key=link,data={"href":"","title":""})
      3-4: mdMark + mdPack(key=link,data={"href":"","title":""})
      "
    `)
  })

  it('nested bold>italic carries both pack keys, inner text in both', () => {
    // The `italic` run carries mdPack(key=bold) AND mdPack(key=italic); the
    // bold-only runs carry only mdPack(key=bold).
    expect(parse('**bold *italic* bold**')).toMatchInlineSnapshot(`
      "
      0-2: mdMark + mdPack(key=bold) + mdStrong
      2-7: mdPack(key=bold) + mdStrong
      7-8: mdEm + mdMark + mdPack(key=bold) + mdPack(key=italic) + mdStrong
      8-14: mdEm + mdPack(key=bold) + mdPack(key=italic) + mdStrong
      14-15: mdEm + mdMark + mdPack(key=bold) + mdPack(key=italic) + mdStrong
      15-20: mdPack(key=bold) + mdStrong
      20-22: mdMark + mdPack(key=bold) + mdStrong
      "
    `)
  })

  it('adjacent links to different urls get distinct pack keys', () => {
    expect(parse('[a](x)[b](y)')).toMatchInlineSnapshot(`
      "
      0-1: mdLinkText(href=x) + mdMark + mdPack(key=link,data={"href":"x","title":""})
      1-2: mdLinkText(href=x) + mdPack(key=link,data={"href":"x","title":""})
      2-4: mdMark + mdPack(key=link,data={"href":"x","title":""})
      4-5: mdLinkUri + mdPack(key=link,data={"href":"x","title":""})
      5-6: mdMark + mdPack(key=link,data={"href":"x","title":""})
      6-7: mdLinkText(href=y) + mdMark + mdPack(key=link,data={"href":"y","title":""})
      7-8: mdLinkText(href=y) + mdPack(key=link,data={"href":"y","title":""})
      8-10: mdMark + mdPack(key=link,data={"href":"y","title":""})
      10-11: mdLinkUri + mdPack(key=link,data={"href":"y","title":""})
      11-12: mdMark + mdPack(key=link,data={"href":"y","title":""})
      "
    `)
  })

  it('wikilink, tag, and bare autolink carry no pack', () => {
    for (const text of ['see [[note]] end', 'hello #tag world', 'visit https://example.com now']) {
      expect(parse(text)).not.toContain('mdPack')
    }
  })
})
