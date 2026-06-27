import { once } from '@ocavue/utils'
import { createMarkBuilders } from '@prosekit/core'
import { describe, expect, it } from 'vitest'

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
  it('plain text', () => {
    expect(parse('hello world')).toMatchInlineSnapshot(`
      "
      [0, 11]
      "
    `)
  })

  it('escaped', () => {
    expect(parse(String.raw`\*not\*`)).toMatchInlineSnapshot(`
      "
      [0, 7]
      "
    `)
  })

  it('hard break', () => {
    expect(parse('a  \nb')).toMatchInlineSnapshot(`
      "
      [0, 5]
      "
    `)
  })

  it('empty', () => {
    expect(parse('')).toMatchInlineSnapshot(`
      "

      "
    `)
  })
})

describe('emphasis', () => {
  it('emphasis', () => {
    expect(parse('Hello *world*')).toMatchInlineSnapshot(`
      "
      [0, 6]
      [6, 7]   mdPack(key=italic) + mdEm + mdMark
      [7, 12]  mdPack(key=italic) + mdEm
      [12, 13] mdPack(key=italic) + mdEm + mdMark
      "
    `)
  })

  it('whole text', () => {
    expect(parse('*all*')).toMatchInlineSnapshot(`
      "
      [0, 1] mdPack(key=italic) + mdEm + mdMark
      [1, 4] mdPack(key=italic) + mdEm
      [4, 5] mdPack(key=italic) + mdEm + mdMark
      "
    `)
  })

  it('twice', () => {
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
})

describe('strong emphasis', () => {
  it('strong emphasis', () => {
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

describe('emphasis and strong', () => {
  it('triple', () => {
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

  it('adjacent', () => {
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

  it('nested', () => {
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
})

describe('inline code', () => {
  it('inline code', () => {
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
  it('strikethrough', () => {
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
  it('highlight', () => {
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
  it('link', () => {
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

  it('title', () => {
    expect(parse('[docs](url "title")')).toMatchInlineSnapshot(`
      "
      [0, 1]   mdPack(key=link,data={"href":"url","title":"title"}) + mdLinkText(href=url) + mdMark
      [1, 5]   mdPack(key=link,data={"href":"url","title":"title"}) + mdLinkText(href=url)
      [5, 7]   mdPack(key=link,data={"href":"url","title":"title"}) + mdMark
      [7, 10]  mdPack(key=link,data={"href":"url","title":"title"}) + mdLinkUri
      [10, 11] mdPack(key=link,data={"href":"url","title":"title"})
      [11, 18] mdPack(key=link,data={"href":"url","title":"title"}) + mdLinkTitle
      [18, 19] mdPack(key=link,data={"href":"url","title":"title"}) + mdMark
      "
    `)
  })

  it('emphasis inside', () => {
    expect(parse('[*italic*](http://x)')).toMatchInlineSnapshot(`
      "
      [0, 1]   mdPack(key=link,data={"href":"http://x","title":""}) + mdLinkText(href=http://x) + mdMark
      [1, 2]   mdPack(key=link,data={"href":"http://x","title":""}) + mdLinkText(href=http://x) + mdEm + mdMark
      [2, 8]   mdPack(key=link,data={"href":"http://x","title":""}) + mdLinkText(href=http://x) + mdEm
      [8, 9]   mdPack(key=link,data={"href":"http://x","title":""}) + mdLinkText(href=http://x) + mdEm + mdMark
      [9, 11]  mdPack(key=link,data={"href":"http://x","title":""}) + mdMark
      [11, 19] mdPack(key=link,data={"href":"http://x","title":""}) + mdLinkUri
      [19, 20] mdPack(key=link,data={"href":"http://x","title":""}) + mdMark
      "
    `)
  })

  it('adjacent', () => {
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

describe('image', () => {
  it('image', () => {
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

  it('empty alt', () => {
    expect(parse('![](z.png)')).toMatchInlineSnapshot(`
      "
      [0, 4]  mdPack(key=image,data={"src":"z.png"}) + mdImageSource(src=z.png) + mdMark
      [4, 9]  mdPack(key=image,data={"src":"z.png"}) + mdImageSource(src=z.png) + mdLinkUri
      [9, 10] mdPack(key=image,data={"src":"z.png"}) + mdImageSource(src=z.png) + mdImageView(src=z.png) + mdMark
      "
    `)
  })

  it('title', () => {
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

  it('formatted alt', () => {
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

  it('reference', () => {
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
})

describe('autolink', () => {
  it('https', () => {
    expect(parse('visit https://example.com now')).toMatchInlineSnapshot(`
      "
      [0, 6]
      [6, 25]  mdLinkText(href=https://example.com)
      [25, 29]
      "
    `)
  })

  it('www', () => {
    expect(parse('see www.example.com here')).toMatchInlineSnapshot(`
      "
      [0, 4]
      [4, 19]  mdLinkText(href=https://www.example.com)
      [19, 24]
      "
    `)
  })

  it('email', () => {
    expect(parse('mail me@example.com ok')).toMatchInlineSnapshot(`
      "
      [0, 5]
      [5, 19]  mdLinkText(href=mailto:me@example.com)
      [19, 22]
      "
    `)
  })

  it('mailto', () => {
    expect(parse('a mailto:me@example.com b')).toMatchInlineSnapshot(`
      "
      [0, 2]
      [2, 23]  mdLinkText(href=mailto:me@example.com)
      [23, 25]
      "
    `)
  })

  it('trailing punctuation', () => {
    expect(parse('end https://example.com.')).toMatchInlineSnapshot(`
      "
      [0, 4]
      [4, 23]  mdLinkText(href=https://example.com)
      [23, 24]
      "
    `)
  })

  it('inside emphasis', () => {
    expect(parse('*https://example.com*')).toMatchInlineSnapshot(`
      "
      [0, 1]   mdPack(key=italic) + mdEm + mdMark
      [1, 20]  mdPack(key=italic) + mdEm + mdLinkText(href=https://example.com)
      [20, 21] mdPack(key=italic) + mdEm + mdMark
      "
    `)
  })

  it('non-http scheme', () => {
    expect(parse('a ftp://example.com b')).toMatchInlineSnapshot(`
      "
      [0, 21]
      "
    `)
  })
})

describe('angle autolink', () => {
  it('https', () => {
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

  it('ftp', () => {
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

  it('ssh', () => {
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
})

describe('bare autolink', () => {
  it('curated TLD', () => {
    expect(parse('a example.com b')).toMatchInlineSnapshot(`
      "
      [0, 2]
      [2, 13]  mdLinkText(href=https://example.com)
      [13, 15]
      "
    `)
  })

  it('off-list TLD', () => {
    expect(parse('a README.md b')).toMatchInlineSnapshot(`
      "
      [0, 13]
      "
    `)
  })

  it('starts text', () => {
    expect(parse('google.com')).toMatchInlineSnapshot(`
      "
      [0, 10] mdLinkText(href=https://google.com)
      "
    `)
  })

  it('with path', () => {
    expect(parse('sub.domain.com/path?q=1')).toMatchInlineSnapshot(`
      "
      [0, 23] mdLinkText(href=https://sub.domain.com/path?q=1)
      "
    `)
  })

  it('preserves case', () => {
    expect(parse('GOOGLE.COM')).toMatchInlineSnapshot(`
      "
      [0, 10] mdLinkText(href=https://GOOGLE.COM)
      "
    `)
  })

  it('trailing period', () => {
    expect(parse('Visit google.com.')).toMatchInlineSnapshot(`
      "
      [0, 6]
      [6, 16]  mdLinkText(href=https://google.com)
      [16, 17]
      "
    `)
  })

  it('code-file name', () => {
    expect(parse('edit node.js then')).toMatchInlineSnapshot(`
      "
      [0, 17]
      "
    `)
  })

  it('www prefix', () => {
    expect(parse('www.example.com')).toMatchInlineSnapshot(`
      "
      [0, 15] mdLinkText(href=https://www.example.com)
      "
    `)
  })

  it('explicit link label', () => {
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

  it('inside inline code', () => {
    expect(parse('`see google.com`')).toMatchInlineSnapshot(`
      "
      [0, 1]   mdPack(key=code) + mdCode + mdMark
      [1, 15]  mdPack(key=code) + mdCode
      [15, 16] mdPack(key=code) + mdCode + mdMark
      "
    `)
  })

  it('email after @', () => {
    expect(parse('mail a@google.com here')).toMatchInlineSnapshot(`
      "
      [0, 5]
      [5, 17]  mdLinkText(href=mailto:a@google.com)
      [17, 22]
      "
    `)
  })
})

describe('tag', () => {
  it('tag', () => {
    expect(parse('a #meow b')).toMatchInlineSnapshot(`
      "
      [0, 2]
      [2, 7] mdTag
      [7, 9]
      "
    `)
  })

  it('twice', () => {
    expect(parse('#a #b')).toMatchInlineSnapshot(`
      "
      [0, 2] mdTag
      [2, 3]
      [3, 5] mdTag
      "
    `)
  })

  it('inside emphasis', () => {
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

  it('inside link label', () => {
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

  it('heading-like', () => {
    expect(parse('# heading text')).toMatchInlineSnapshot(`
      "
      [0, 14]
      "
    `)
  })

  it('all-digit', () => {
    expect(parse("we're #1")).toMatchInlineSnapshot(`
      "
      [0, 8]
      "
    `)
  })
})

describe('wikilink', () => {
  it('wikilink', () => {
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

  it('adjacent', () => {
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

  it('inside emphasis', () => {
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

  it('inside link label', () => {
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

  it('tag inside target', () => {
    expect(parse('[[note #tag]]')).toMatchInlineSnapshot(`
      "
      [0, 2]   mdWikilinkSource(target=note #tag) + mdMark
      [2, 11]  mdWikilinkSource(target=note #tag)
      [11, 12] mdWikilinkSource(target=note #tag) + mdMark
      [12, 13] mdWikilinkSource(target=note #tag) + mdWikilinkView(target=note #tag) + mdMark
      "
    `)
  })

  it('unclosed', () => {
    // The inner `[a]` becomes a shortcut reference link (lezer behavior).
    expect(parse('[[a]')).toMatchInlineSnapshot(`
      "
      [0, 1]
      [1, 2] mdPack(key=link,data={"href":"","title":""}) + mdMark
      [2, 3] mdPack(key=link,data={"href":"","title":""})
      [3, 4] mdPack(key=link,data={"href":"","title":""}) + mdMark
      "
    `)
  })
})
