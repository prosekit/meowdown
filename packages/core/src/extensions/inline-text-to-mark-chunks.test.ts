import { createMarkBuilders } from '@prosekit/core'
import { describe, expect, it } from 'vitest'

import { once } from '@ocavue/utils'
import { defineEditorExtension, type EditorExtension } from './extension.ts'
import { inlineTextToMarkChunks } from './inline-text-to-mark-chunks.ts'
import type { MarkChunk } from './mark-chunk.ts'
import type { TypedMarkBuilders } from './schema.ts'

function formatMarkChunk([from, to, marks]: MarkChunk): [string, string] {
  const body = marks
    .map((mark) => {
      const attrs = mark.attrs as Record<string, unknown>
      const keys = Object.keys(attrs)
      if (keys.length === 0) return mark.type.name
      const filtered = keys.filter((k) => attrs[k] !== '' && attrs[k] != null)
      if (filtered.length === 0) return mark.type.name
      const attrStr = filtered
        .map((k) => {
          const value = attrs[k]
          const rendered = typeof value === 'string' ? value : JSON.stringify(value)
          return `${k}=${rendered}`
        })
        .join(',')
      return `${mark.type.name}(${attrStr})`
    })
    .join(' + ')
  const head = `[${from}, ${to}]`
  return [head, body]
}

const getMarkBuilders = once((): TypedMarkBuilders => {
  const schema = defineEditorExtension().schema!
  return createMarkBuilders<EditorExtension>(schema)
})

function parse(text: string): string {
  const markBuilders = getMarkBuilders()
  const chunks = inlineTextToMarkChunks(markBuilders, text)
  const formatted = chunks.map(formatMarkChunk)
  const headLength = Math.max(...formatted.map(([head]) => head.length))
  const lines = formatted.map(([head, body]) => {
    return (head.padEnd(headLength, ' ') + ' ' + body).trim()
  })
  return '\n' + lines.join('\n') + '\n'
}

describe('plain text', () => {
  it('returns no marks for plain text', () => {
    expect(parse('hello world')).toMatchInlineSnapshot(`
      "
      [0, 11]
      "
    `)
  })
})

describe('emphasis', () => {
  it('can parse emphasis', () => {
    expect(parse('Hello *world*')).toMatchInlineSnapshot(`
      "
      [0, 6]
      [6, 7]   mdPack(key=italic) + mdEm + mdMark
      [7, 12]  mdPack(key=italic) + mdEm
      [12, 13] mdPack(key=italic) + mdEm + mdMark
      "
    `)
  })
})

describe('strong emphasis', () => {
  it('can parse strong emphasis', () => {
    expect(parse('a **bold** b')).toMatchInlineSnapshot(`
      "
      [0, 2]
      [2, 4]   mdPack(key=bold) + mdStrong + mdMark
      [4, 8]   mdPack(key=bold) + mdStrong
      [8, 10]  mdPack(key=bold) + mdStrong + mdMark
      [10, 12]
      "
    `)
  })
})

describe('inline code', () => {
  it('can parse inline code', () => {
    expect(parse('a `c` b')).toMatchInlineSnapshot(`
      "
      [0, 2]
      [2, 3] mdPack(key=code) + mdCode + mdMark
      [3, 4] mdPack(key=code) + mdCode
      [4, 5] mdPack(key=code) + mdCode + mdMark
      [5, 7]
      "
    `)
  })
})

describe('strikethrough', () => {
  it('can parse strikethrough', () => {
    expect(parse('a ~~b~~ c')).toMatchInlineSnapshot(`
      "
      [0, 2]
      [2, 4] mdPack(key=strike) + mdDel + mdMark
      [4, 5] mdPack(key=strike) + mdDel
      [5, 7] mdPack(key=strike) + mdDel + mdMark
      [7, 9]
      "
    `)
  })
})

describe('highlight', () => {
  it('can parse highlight', () => {
    expect(parse('a ==b== c')).toMatchInlineSnapshot(`
      "
      [0, 2]
      [2, 4] mdPack(key=highlight) + mdHighlight + mdMark
      [4, 5] mdPack(key=highlight) + mdHighlight
      [5, 7] mdPack(key=highlight) + mdHighlight + mdMark
      [7, 9]
      "
    `)
  })
})

describe('link', () => {
  it('can parse link', () => {
    expect(parse('[text](url)')).toMatchInlineSnapshot(`
      "
      [0, 1]   mdPack(key=link,data={"href":"url","title":""}) + mdLinkText(href=url) + mdMark
      [1, 5]   mdPack(key=link,data={"href":"url","title":""}) + mdLinkText(href=url)
      [5, 7]   mdPack(key=link,data={"href":"url","title":""}) + mdMark
      [7, 10]  mdPack(key=link,data={"href":"url","title":""}) + mdLinkUri
      [10, 11] mdPack(key=link,data={"href":"url","title":""}) + mdMark
      "
    `)
  })

  it('link with href on its text portion', () => {
    expect(parse('see [docs](http://x) now')).toMatchInlineSnapshot(`
      "
      [0, 4]
      [4, 5]   mdPack(key=link,data={"href":"http://x","title":""}) + mdLinkText(href=http://x) + mdMark
      [5, 9]   mdPack(key=link,data={"href":"http://x","title":""}) + mdLinkText(href=http://x)
      [9, 11]  mdPack(key=link,data={"href":"http://x","title":""}) + mdMark
      [11, 19] mdPack(key=link,data={"href":"http://x","title":""}) + mdLinkUri
      [19, 20] mdPack(key=link,data={"href":"http://x","title":""}) + mdMark
      [20, 24]
      "
    `)
  })

  it('link with a title marks the title with mdLinkTitle', () => {
    expect(parse('[docs](http://x "t")')).toMatchInlineSnapshot(`
      "
      [0, 1]   mdPack(key=link,data={"href":"http://x","title":"t"}) + mdLinkText(href=http://x) + mdMark
      [1, 5]   mdPack(key=link,data={"href":"http://x","title":"t"}) + mdLinkText(href=http://x)
      [5, 7]   mdPack(key=link,data={"href":"http://x","title":"t"}) + mdMark
      [7, 15]  mdPack(key=link,data={"href":"http://x","title":"t"}) + mdLinkUri
      [15, 16] mdPack(key=link,data={"href":"http://x","title":"t"})
      [16, 19] mdPack(key=link,data={"href":"http://x","title":"t"}) + mdLinkTitle
      [19, 20] mdPack(key=link,data={"href":"http://x","title":"t"}) + mdMark
      "
    `)
  })

  it('link with emphasis nested inside the text', () => {
    expect(parse('[*ital*](http://x)')).toMatchInlineSnapshot(`
      "
      [0, 1]   mdPack(key=link,data={"href":"http://x","title":""}) + mdLinkText(href=http://x) + mdMark
      [1, 2]   mdPack(key=link,data={"href":"http://x","title":""}) + mdLinkText(href=http://x) + mdEm + mdMark
      [2, 6]   mdPack(key=link,data={"href":"http://x","title":""}) + mdLinkText(href=http://x) + mdEm
      [6, 7]   mdPack(key=link,data={"href":"http://x","title":""}) + mdLinkText(href=http://x) + mdEm + mdMark
      [7, 9]   mdPack(key=link,data={"href":"http://x","title":""}) + mdMark
      [9, 17]  mdPack(key=link,data={"href":"http://x","title":""}) + mdLinkUri
      [17, 18] mdPack(key=link,data={"href":"http://x","title":""}) + mdMark
      "
    `)
  })

  it('image: mdImageSource over the source, mdImageView on the final char', () => {
    expect(parse('see ![alt](http://x/p.png) end')).toMatchInlineSnapshot(`
      "
      [0, 4]
      [4, 6]   mdPack(key=image,data={"src":"http://x/p.png"}) + mdImageSource(src=http://x/p.png,alt=alt) + mdMark
      [6, 9]   mdPack(key=image,data={"src":"http://x/p.png"}) + mdImageSource(src=http://x/p.png,alt=alt)
      [9, 11]  mdPack(key=image,data={"src":"http://x/p.png"}) + mdImageSource(src=http://x/p.png,alt=alt) + mdMark
      [11, 25] mdPack(key=image,data={"src":"http://x/p.png"}) + mdImageSource(src=http://x/p.png,alt=alt) + mdLinkUri
      [25, 26] mdPack(key=image,data={"src":"http://x/p.png"}) + mdImageSource(src=http://x/p.png,alt=alt) + mdImageView(src=http://x/p.png,alt=alt) + mdMark
      [26, 30]
      "
    `)
  })

  it('image with empty alt', () => {
    expect(parse('![](z.png)')).toMatchInlineSnapshot(`
      "
      [0, 4]  mdPack(key=image,data={"src":"z.png"}) + mdImageSource(src=z.png) + mdMark
      [4, 9]  mdPack(key=image,data={"src":"z.png"}) + mdImageSource(src=z.png) + mdLinkUri
      [9, 10] mdPack(key=image,data={"src":"z.png"}) + mdImageSource(src=z.png) + mdImageView(src=z.png) + mdMark
      "
    `)
  })

  it('reference image does not get image marks (falls through to the link walk)', () => {
    expect(parse('a ![b][id] c')).toMatchInlineSnapshot(`
      "
      [0, 2]
      [2, 4]   mdPack(key=link,data={"href":"","title":""}) + mdMark
      [4, 5]   mdPack(key=link,data={"href":"","title":""})
      [5, 6]   mdPack(key=link,data={"href":"","title":""}) + mdMark
      [6, 10]  mdPack(key=link,data={"href":"","title":""})
      [10, 12]
      "
    `)
  })

  it('image with a title marks the title node like a link title', () => {
    expect(parse('![a](http://x "t")')).toMatchInlineSnapshot(`
      "
      [0, 2]   mdPack(key=image,data={"src":"http://x"}) + mdImageSource(src=http://x,alt=a) + mdMark
      [2, 3]   mdPack(key=image,data={"src":"http://x"}) + mdImageSource(src=http://x,alt=a)
      [3, 5]   mdPack(key=image,data={"src":"http://x"}) + mdImageSource(src=http://x,alt=a) + mdMark
      [5, 13]  mdPack(key=image,data={"src":"http://x"}) + mdImageSource(src=http://x,alt=a) + mdLinkUri
      [13, 14] mdPack(key=image,data={"src":"http://x"}) + mdImageSource(src=http://x,alt=a)
      [14, 17] mdPack(key=image,data={"src":"http://x"}) + mdImageSource(src=http://x,alt=a) + mdLinkTitle
      [17, 18] mdPack(key=image,data={"src":"http://x"}) + mdImageSource(src=http://x,alt=a) + mdImageView(src=http://x,alt=a) + mdMark
      "
    `)
  })

  it('image with formatted alt marks the nested emphasis', () => {
    expect(parse('![a **b** c](http://x)')).toMatchInlineSnapshot(`
      "
      [0, 2]   mdPack(key=image,data={"src":"http://x"}) + mdImageSource(src=http://x,alt=a **b** c) + mdMark
      [2, 4]   mdPack(key=image,data={"src":"http://x"}) + mdImageSource(src=http://x,alt=a **b** c)
      [4, 6]   mdPack(key=image,data={"src":"http://x"}) + mdImageSource(src=http://x,alt=a **b** c) + mdStrong + mdMark
      [6, 7]   mdPack(key=image,data={"src":"http://x"}) + mdImageSource(src=http://x,alt=a **b** c) + mdStrong
      [7, 9]   mdPack(key=image,data={"src":"http://x"}) + mdImageSource(src=http://x,alt=a **b** c) + mdStrong + mdMark
      [9, 11]  mdPack(key=image,data={"src":"http://x"}) + mdImageSource(src=http://x,alt=a **b** c)
      [11, 13] mdPack(key=image,data={"src":"http://x"}) + mdImageSource(src=http://x,alt=a **b** c) + mdMark
      [13, 21] mdPack(key=image,data={"src":"http://x"}) + mdImageSource(src=http://x,alt=a **b** c) + mdLinkUri
      [21, 22] mdPack(key=image,data={"src":"http://x"}) + mdImageSource(src=http://x,alt=a **b** c) + mdImageView(src=http://x,alt=a **b** c) + mdMark
      "
    `)
  })
})

describe('autolink', () => {
  it('autolinks a bare https URL', () => {
    expect(parse('visit https://example.com now')).toMatchInlineSnapshot(`
      "
      [0, 6]
      [6, 25]  mdLinkText(href=https://example.com)
      [25, 29]
      "
    `)
  })

  it('autolinks a www URL with an implied https scheme', () => {
    expect(parse('see www.example.com here')).toMatchInlineSnapshot(`
      "
      [0, 4]
      [4, 19]  mdLinkText(href=https://www.example.com)
      [19, 24]
      "
    `)
  })

  it('autolinks a bare email as mailto', () => {
    expect(parse('mail me@example.com ok')).toMatchInlineSnapshot(`
      "
      [0, 5]
      [5, 19]  mdLinkText(href=mailto:me@example.com)
      [19, 22]
      "
    `)
  })

  it('autolinks a bare mailto URL, keeping the scheme', () => {
    expect(parse('a mailto:me@example.com b')).toMatchInlineSnapshot(`
      "
      [0, 2]
      [2, 23]  mdLinkText(href=mailto:me@example.com)
      [23, 25]
      "
    `)
  })

  it('autolinks an angle-bracket URL, with the brackets as mdMark', () => {
    expect(parse('a <https://example.com> b')).toMatchInlineSnapshot(`
      "
      [0, 2]
      [2, 3]   mdPack(key=autolink) + mdMark
      [3, 22]  mdPack(key=autolink) + mdLinkText(href=https://example.com)
      [22, 23] mdPack(key=autolink) + mdMark
      [23, 25]
      "
    `)
  })

  it('keeps a non-http scheme in an angle autolink', () => {
    expect(parse('a <ftp://example.com> b')).toMatchInlineSnapshot(`
      "
      [0, 2]
      [2, 3]   mdPack(key=autolink) + mdMark
      [3, 20]  mdPack(key=autolink) + mdLinkText(href=ftp://example.com)
      [20, 21] mdPack(key=autolink) + mdMark
      [21, 23]
      "
    `)
  })

  it('keeps an ssh scheme in an angle autolink', () => {
    expect(parse('a <ssh://example.com> b')).toMatchInlineSnapshot(`
      "
      [0, 2]
      [2, 3]   mdPack(key=autolink) + mdMark
      [3, 20]  mdPack(key=autolink) + mdLinkText(href=ssh://example.com)
      [20, 21] mdPack(key=autolink) + mdMark
      [21, 23]
      "
    `)
  })

  it('excludes trailing punctuation from an autolink', () => {
    expect(parse('end https://example.com.')).toMatchInlineSnapshot(`
      "
      [0, 4]
      [4, 23]  mdLinkText(href=https://example.com)
      [23, 24]
      "
    `)
  })

  it('autolinks a URL nested in emphasis', () => {
    expect(parse('*https://example.com*')).toMatchInlineSnapshot(`
      "
      [0, 1]   mdPack(key=italic) + mdEm + mdMark
      [1, 20]  mdPack(key=italic) + mdEm + mdLinkText(href=https://example.com)
      [20, 21] mdPack(key=italic) + mdEm + mdMark
      "
    `)
  })

  it('does not bare-autolink a non-http scheme', () => {
    expect(parse('a ftp://example.com b')).toMatchInlineSnapshot(`
      "
      [0, 21]
      "
    `)
  })

  it('autolinks a bare domain on the curated TLD list', () => {
    expect(parse('a example.com b')).toMatchInlineSnapshot(`
      "
      [0, 2]
      [2, 13]  mdLinkText(href=https://example.com)
      [13, 15]
      "
    `)
  })

  it('does not autolink a bare host whose TLD is off the list', () => {
    expect(parse('a README.md b')).toMatchInlineSnapshot(`
      "
      [0, 13]
      "
    `)
  })

  it('bare-autolinks a domain that starts the text', () => {
    expect(parse('google.com')).toMatchInlineSnapshot(`
      "
      [0, 10] mdLinkText(href=https://google.com)
      "
    `)
  })

  it('bare-autolinks a domain with a path, keeping the path in the href', () => {
    expect(parse('sub.domain.com/path?q=1')).toMatchInlineSnapshot(`
      "
      [0, 23] mdLinkText(href=https://sub.domain.com/path?q=1)
      "
    `)
  })

  it('preserves case in the bare-autolink href', () => {
    expect(parse('GOOGLE.COM')).toMatchInlineSnapshot(`
      "
      [0, 10] mdLinkText(href=https://GOOGLE.COM)
      "
    `)
  })

  it('excludes a trailing period from a bare autolink', () => {
    expect(parse('Visit google.com.')).toMatchInlineSnapshot(`
      "
      [0, 6]
      [6, 16]  mdLinkText(href=https://google.com)
      [16, 17]
      "
    `)
  })

  it('does not bare-autolink a code-file name', () => {
    expect(parse('edit node.js then')).toMatchInlineSnapshot(`
      "
      [0, 17]
      "
    `)
  })

  it('claims a www. autolink as one chunk, not a nested bare domain', () => {
    expect(parse('www.example.com')).toMatchInlineSnapshot(`
      "
      [0, 15] mdLinkText(href=https://www.example.com)
      "
    `)
  })

  it('does not bare-autolink the label of an explicit link', () => {
    expect(parse('[google.com](http://x)')).toMatchInlineSnapshot(`
      "
      [0, 1]   mdPack(key=link,data={"href":"http://x","title":""}) + mdLinkText(href=http://x) + mdMark
      [1, 11]  mdPack(key=link,data={"href":"http://x","title":""}) + mdLinkText(href=http://x)
      [11, 13] mdPack(key=link,data={"href":"http://x","title":""}) + mdMark
      [13, 21] mdPack(key=link,data={"href":"http://x","title":""}) + mdLinkUri
      [21, 22] mdPack(key=link,data={"href":"http://x","title":""}) + mdMark
      "
    `)
  })

  it('does not bare-autolink inside inline code', () => {
    expect(parse('`see google.com`')).toMatchInlineSnapshot(`
      "
      [0, 1]   mdPack(key=code) + mdCode + mdMark
      [1, 15]  mdPack(key=code) + mdCode
      [15, 16] mdPack(key=code) + mdCode + mdMark
      "
    `)
  })

  it('does not bare-autolink a domain after an @ (it is an email)', () => {
    expect(parse('mail a@google.com here')).toMatchInlineSnapshot(`
      "
      [0, 5]
      [5, 17]  mdLinkText(href=mailto:a@google.com)
      [17, 22]
      "
    `)
  })

  it('nested emphasis inside strong (***foo***)', () => {
    expect(parse('***foo***')).toMatchInlineSnapshot(`
      "
      [0, 1] mdPack(key=italic) + mdEm + mdMark
      [1, 3] mdPack(key=italic) + mdEm + mdPack(key=bold) + mdStrong + mdMark
      [3, 6] mdPack(key=italic) + mdEm + mdPack(key=bold) + mdStrong
      [6, 8] mdPack(key=italic) + mdEm + mdPack(key=bold) + mdStrong + mdMark
      [8, 9] mdPack(key=italic) + mdEm + mdMark
      "
    `)
  })

  it('adjacent emphasis and strong', () => {
    expect(parse('*a***b**')).toMatchInlineSnapshot(`
      "
      [0, 1] mdPack(key=italic) + mdEm + mdMark
      [1, 2] mdPack(key=italic) + mdEm
      [2, 3] mdPack(key=italic) + mdEm + mdMark
      [3, 5] mdPack(key=bold) + mdStrong + mdMark
      [5, 6] mdPack(key=bold) + mdStrong
      [6, 8] mdPack(key=bold) + mdStrong + mdMark
      "
    `)
  })

  it('emphasis at start and end of text', () => {
    expect(parse('*a* mid *b*')).toMatchInlineSnapshot(`
      "
      [0, 1]   mdPack(key=italic) + mdEm + mdMark
      [1, 2]   mdPack(key=italic) + mdEm
      [2, 3]   mdPack(key=italic) + mdEm + mdMark
      [3, 8]
      [8, 9]   mdPack(key=italic) + mdEm + mdMark
      [9, 10]  mdPack(key=italic) + mdEm
      [10, 11] mdPack(key=italic) + mdEm + mdMark
      "
    `)
  })

  it('entire content is emphasized', () => {
    expect(parse('*all*')).toMatchInlineSnapshot(`
      "
      [0, 1] mdPack(key=italic) + mdEm + mdMark
      [1, 4] mdPack(key=italic) + mdEm
      [4, 5] mdPack(key=italic) + mdEm + mdMark
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
      [0, 7]
      "
    `)
  })

  it('hard break produces no mark', () => {
    expect(parse('a  \nb')).toMatchInlineSnapshot(`
      "
      [0, 5]
      "
    `)
  })

  it('tag yields a single mdTag chunk covering the # too', () => {
    expect(parse('a #meow b')).toMatchInlineSnapshot(`
      "
      [0, 2]
      [2, 7] mdTag
      [7, 9]
      "
    `)
  })

  it('two tags', () => {
    expect(parse('#a #b')).toMatchInlineSnapshot(`
      "
      [0, 2] mdTag
      [2, 3]
      [3, 5] mdTag
      "
    `)
  })

  it('tag inside emphasis', () => {
    expect(parse('*x #tag y*')).toMatchInlineSnapshot(`
      "
      [0, 1]  mdPack(key=italic) + mdEm + mdMark
      [1, 3]  mdPack(key=italic) + mdEm
      [3, 7]  mdPack(key=italic) + mdEm + mdTag
      [7, 9]  mdPack(key=italic) + mdEm
      [9, 10] mdPack(key=italic) + mdEm + mdMark
      "
    `)
  })

  it('tag inside a link label', () => {
    expect(parse('[see #tag](http://x)')).toMatchInlineSnapshot(`
      "
      [0, 1]   mdPack(key=link,data={"href":"http://x","title":""}) + mdLinkText(href=http://x) + mdMark
      [1, 5]   mdPack(key=link,data={"href":"http://x","title":""}) + mdLinkText(href=http://x)
      [5, 9]   mdPack(key=link,data={"href":"http://x","title":""}) + mdLinkText(href=http://x) + mdTag
      [9, 11]  mdPack(key=link,data={"href":"http://x","title":""}) + mdMark
      [11, 19] mdPack(key=link,data={"href":"http://x","title":""}) + mdLinkUri
      [19, 20] mdPack(key=link,data={"href":"http://x","title":""}) + mdMark
      "
    `)
  })

  it('heading-like text produces no tag', () => {
    expect(parse('# heading text')).toMatchInlineSnapshot(`
      "
      [0, 14]
      "
    `)
  })

  it('all-digit tag produces no mark', () => {
    expect(parse("we're #1")).toMatchInlineSnapshot(`
      "
      [0, 8]
      "
    `)
  })

  it('wikilink yields mdMark brackets around an mdWikilinkSource target', () => {
    expect(parse('a [[note]] b')).toMatchInlineSnapshot(`
      "
      [0, 2]
      [2, 4]   mdWikilinkSource(target=note) + mdMark
      [4, 8]   mdWikilinkSource(target=note)
      [8, 9]   mdWikilinkSource(target=note) + mdMark
      [9, 10]  mdWikilinkSource(target=note) + mdWikilinkView(target=note) + mdMark
      [10, 12]
      "
    `)
  })

  it('adjacent wikilinks stay distinct via their target attribute', () => {
    expect(parse('[[a]][[b]]')).toMatchInlineSnapshot(`
      "
      [0, 2]  mdWikilinkSource(target=a) + mdMark
      [2, 3]  mdWikilinkSource(target=a)
      [3, 4]  mdWikilinkSource(target=a) + mdMark
      [4, 5]  mdWikilinkSource(target=a) + mdWikilinkView(target=a) + mdMark
      [5, 7]  mdWikilinkSource(target=b) + mdMark
      [7, 8]  mdWikilinkSource(target=b)
      [8, 9]  mdWikilinkSource(target=b) + mdMark
      [9, 10] mdWikilinkSource(target=b) + mdWikilinkView(target=b) + mdMark
      "
    `)
  })

  it('wikilink inside emphasis', () => {
    expect(parse('*x [[n]] y*')).toMatchInlineSnapshot(`
      "
      [0, 1]   mdPack(key=italic) + mdEm + mdMark
      [1, 3]   mdPack(key=italic) + mdEm
      [3, 5]   mdPack(key=italic) + mdEm + mdWikilinkSource(target=n) + mdMark
      [5, 6]   mdPack(key=italic) + mdEm + mdWikilinkSource(target=n)
      [6, 7]   mdPack(key=italic) + mdEm + mdWikilinkSource(target=n) + mdMark
      [7, 8]   mdPack(key=italic) + mdEm + mdWikilinkSource(target=n) + mdWikilinkView(target=n) + mdMark
      [8, 10]  mdPack(key=italic) + mdEm
      [10, 11] mdPack(key=italic) + mdEm + mdMark
      "
    `)
  })

  it('wikilink inside a link label', () => {
    expect(parse('[see [[x]]](http://y)')).toMatchInlineSnapshot(`
      "
      [0, 1]   mdPack(key=link,data={"href":"http://y","title":""}) + mdLinkText(href=http://y) + mdMark
      [1, 5]   mdPack(key=link,data={"href":"http://y","title":""}) + mdLinkText(href=http://y)
      [5, 7]   mdPack(key=link,data={"href":"http://y","title":""}) + mdLinkText(href=http://y) + mdWikilinkSource(target=x) + mdMark
      [7, 8]   mdPack(key=link,data={"href":"http://y","title":""}) + mdLinkText(href=http://y) + mdWikilinkSource(target=x)
      [8, 9]   mdPack(key=link,data={"href":"http://y","title":""}) + mdLinkText(href=http://y) + mdWikilinkSource(target=x) + mdMark
      [9, 10]  mdPack(key=link,data={"href":"http://y","title":""}) + mdLinkText(href=http://y) + mdWikilinkSource(target=x) + mdWikilinkView(target=x) + mdMark
      [10, 12] mdPack(key=link,data={"href":"http://y","title":""}) + mdMark
      [12, 20] mdPack(key=link,data={"href":"http://y","title":""}) + mdLinkUri
      [20, 21] mdPack(key=link,data={"href":"http://y","title":""}) + mdMark
      "
    `)
  })

  it('no mdTag inside a wikilink target', () => {
    expect(parse('[[note #tag]]')).toMatchInlineSnapshot(`
      "
      [0, 2]   mdWikilinkSource(target=note #tag) + mdMark
      [2, 11]  mdWikilinkSource(target=note #tag)
      [11, 12] mdWikilinkSource(target=note #tag) + mdMark
      [12, 13] mdWikilinkSource(target=note #tag) + mdWikilinkView(target=note #tag) + mdMark
      "
    `)
  })

  it('unclosed wikilink falls back to link parsing of the inner [a]', () => {
    // No mdWikilinkSource anywhere; the inner `[a]` becomes a shortcut
    // reference link (pre-existing lezer behavior).
    expect(parse('[[a]')).toMatchInlineSnapshot(`
      "
      [0, 1]
      [1, 2] mdPack(key=link,data={"href":"","title":""}) + mdMark
      [2, 3] mdPack(key=link,data={"href":"","title":""})
      [3, 4] mdPack(key=link,data={"href":"","title":""}) + mdMark
      "
    `)
  })

  it('nested bold>italic carries both pack keys, inner text in both', () => {
    // The `italic` run carries mdPack(key=bold) AND mdPack(key=italic); the
    // bold-only runs carry only mdPack(key=bold).
    expect(parse('**bold *italic* bold**')).toMatchInlineSnapshot(`
      "
      [0, 2]   mdPack(key=bold) + mdStrong + mdMark
      [2, 7]   mdPack(key=bold) + mdStrong
      [7, 8]   mdPack(key=bold) + mdStrong + mdPack(key=italic) + mdEm + mdMark
      [8, 14]  mdPack(key=bold) + mdStrong + mdPack(key=italic) + mdEm
      [14, 15] mdPack(key=bold) + mdStrong + mdPack(key=italic) + mdEm + mdMark
      [15, 20] mdPack(key=bold) + mdStrong
      [20, 22] mdPack(key=bold) + mdStrong + mdMark
      "
    `)
  })

  it('adjacent links to different urls get distinct pack keys', () => {
    expect(parse('[a](x)[b](y)')).toMatchInlineSnapshot(`
      "
      [0, 1]   mdPack(key=link,data={"href":"x","title":""}) + mdLinkText(href=x) + mdMark
      [1, 2]   mdPack(key=link,data={"href":"x","title":""}) + mdLinkText(href=x)
      [2, 4]   mdPack(key=link,data={"href":"x","title":""}) + mdMark
      [4, 5]   mdPack(key=link,data={"href":"x","title":""}) + mdLinkUri
      [5, 6]   mdPack(key=link,data={"href":"x","title":""}) + mdMark
      [6, 7]   mdPack(key=link,data={"href":"y","title":""}) + mdLinkText(href=y) + mdMark
      [7, 8]   mdPack(key=link,data={"href":"y","title":""}) + mdLinkText(href=y)
      [8, 10]  mdPack(key=link,data={"href":"y","title":""}) + mdMark
      [10, 11] mdPack(key=link,data={"href":"y","title":""}) + mdLinkUri
      [11, 12] mdPack(key=link,data={"href":"y","title":""}) + mdMark
      "
    `)
  })
})
