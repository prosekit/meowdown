import { once } from '@ocavue/utils'
import { createMarkBuilders } from '@prosekit/core'
import { describe, expect, it, vi } from 'vitest'

import { defineEditorExtension, type EditorExtension } from './extension.ts'
import {
  inlineTextToMarkChunks,
  type FileLinkOptions,
  type FileLinkResolver,
} from './inline-text-to-mark-chunks.ts'
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

function parse(text: string, options?: FileLinkOptions): string {
  const markBuilders = getMarkBuilders()
  const chunks = inlineTextToMarkChunks(markBuilders, text, options)
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

describe('math', () => {
  it('math', () => {
    expect(parse('a $x$ b')).toMatchInlineSnapshot(`
      "
      [0, 2]
      [2, 3] mdPack(key=math) + mdMath(formula=x) + mdMark
      [3, 4] mdPack(key=math) + mdMath(formula=x)
      [4, 5] mdPack(key=math) + mdMath(formula=x) + mdMark
      [5, 7]
      "
    `)
  })

  it('double dollar', () => {
    expect(parse('$$x+y$$')).toMatchInlineSnapshot(`
      "
      [0, 2] mdPack(key=math) + mdMath(formula=x+y) + mdMark
      [2, 5] mdPack(key=math) + mdMath(formula=x+y)
      [5, 7] mdPack(key=math) + mdMath(formula=x+y) + mdMark
      "
    `)
  })

  it('formula with backslashes', () => {
    expect(parse(String.raw`$\frac{1}{2}$`)).toMatchInlineSnapshot(`
      "
      [0, 1]   mdPack(key=math) + mdMath(formula=\\frac{1}{2}) + mdMark
      [1, 12]  mdPack(key=math) + mdMath(formula=\\frac{1}{2})
      [12, 13] mdPack(key=math) + mdMath(formula=\\frac{1}{2}) + mdMark
      "
    `)
  })

  it('escaped dollar inside the formula', () => {
    expect(parse(String.raw`$a \$ b$`)).toMatchInlineSnapshot(`
      "
      [0, 1] mdPack(key=math) + mdMath(formula=a \\$ b) + mdMark
      [1, 7] mdPack(key=math) + mdMath(formula=a \\$ b)
      [7, 8] mdPack(key=math) + mdMath(formula=a \\$ b) + mdMark
      "
    `)
  })

  it('inside bold', () => {
    expect(parse('**$x$**')).toMatchInlineSnapshot(`
      "
      [0, 2] mdPack(key=bold) + mdStrong + mdMark
      [2, 3] mdPack(key=bold) + mdStrong + mdPack(key=math) + mdMath(formula=x) + mdMark
      [3, 4] mdPack(key=bold) + mdStrong + mdPack(key=math) + mdMath(formula=x)
      [4, 5] mdPack(key=bold) + mdStrong + mdPack(key=math) + mdMath(formula=x) + mdMark
      [5, 7] mdPack(key=bold) + mdStrong + mdMark
      "
    `)
  })

  it('currency stays plain text', () => {
    expect(parse('$20,000 and $30,000')).toMatchInlineSnapshot(`
      "
      [0, 19]
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
    expect(parse('![ALT](URL "TITLE")')).toMatchInlineSnapshot(`
      "
      [0, 19] mdImage(src=URL,alt=ALT,title=TITLE)
      "
    `)
  })

  it('only URL', () => {
    expect(parse('![](image.png)')).toMatchInlineSnapshot(`
      "
      [0, 14] mdImage(src=image.png)
      "
    `)
  })

  it('empty title', () => {
    expect(parse('![a](http://x "")')).toMatchInlineSnapshot(`
      "
      [0, 17] mdImage(src=http://x,alt=a)
      "
    `)
  })

  it('formatted alt', () => {
    expect(parse('![a **b** c](http://x)')).toMatchInlineSnapshot(`
      "
      [0, 22] mdImage(src=http://x,alt=a **b** c)
      "
    `)
  })

  it('wrapped by text', () => {
    expect(parse('text ![a](url) text')).toMatchInlineSnapshot(`
      "
      [0, 5]
      [5, 14]  mdImage(src=url,alt=a)
      [14, 19]
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

  it('folds a trailing width comment into the image mark', () => {
    expect(parse('![a](u)<!-- {"width":320} -->')).toMatchInlineSnapshot(`
      "
      [0, 29] mdImage(src=u,alt=a,width=320)
      "
    `)
  })

  it('keeps a non-adjacent comment separate', () => {
    expect(parse('![a](u) <!-- {"width":320} -->')).toMatchInlineSnapshot(`
      "
      [0, 7]  mdImage(src=u,alt=a)
      [7, 30]
      "
    `)
  })

  it('folds the comment when the image is wrapped by text', () => {
    expect(parse('x ![a](u)<!-- {"width":50} --> y')).toMatchInlineSnapshot(`
      "
      [0, 2]
      [2, 30]  mdImage(src=u,alt=a,width=50)
      [30, 32]
      "
    `)
  })

  it('ignores a non-metadata comment after an image', () => {
    expect(parse('![a](u)<!-- note -->')).toMatchInlineSnapshot(`
      "
      [0, 7]  mdImage(src=u,alt=a)
      [7, 20]
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
      [2, 10]  mdWikilink(target=note)
      [10, 12]
      "
    `)
  })

  it('adjacent', () => {
    expect(parse('[[a]][[b]]')).toMatchInlineSnapshot(`
      "
      [0, 5]  mdWikilink(target=a)
      [5, 10] mdWikilink(target=b)
      "
    `)
  })

  it('inside emphasis', () => {
    expect(parse('*x [[n]] y*')).toMatchInlineSnapshot(`
      "
      [0, 1]   mdPack(key=italic) + mdEm + mdMark
      [1, 3]   mdPack(key=italic) + mdEm
      [3, 8]   mdPack(key=italic) + mdEm + mdWikilink(target=n)
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
      [5, 10]  mdPack(key=link,data={"href":"http://y","title":""}) + mdLinkText(href=http://y) + mdWikilink(target=x)
      [10, 12] mdPack(key=link,data={"href":"http://y","title":""}) + mdMark
      [12, 20] mdPack(key=link,data={"href":"http://y","title":""}) + mdLinkUri
      [20, 21] mdPack(key=link,data={"href":"http://y","title":""}) + mdMark
      "
    `)
  })

  it('tag inside target', () => {
    expect(parse('[[note #tag]]')).toMatchInlineSnapshot(`
      "
      [0, 13] mdWikilink(target=note #tag)
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

describe('file link', () => {
  const claimAssets: FileLinkResolver = ({ href }) => href.startsWith('assets/')

  it('claims a link as a file', () => {
    expect(parse('see [report.pdf](assets/report.pdf) end', { resolveFileLink: claimAssets }))
      .toMatchInlineSnapshot(`
        "
        [0, 4]
        [4, 35]  mdFile(href=assets/report.pdf,name=report.pdf)
        [35, 39]
        "
      `)
  })

  it('leaves a declined link as a regular link', () => {
    expect(parse('[report.pdf](assets/report.pdf)', { resolveFileLink: () => false }))
      .toMatchInlineSnapshot(`
      "
      [0, 1]   mdPack(key=link,data={"href":"assets/report.pdf","title":""}) + mdLinkText(href=assets/report.pdf) + mdMark
      [1, 11]  mdPack(key=link,data={"href":"assets/report.pdf","title":""}) + mdLinkText(href=assets/report.pdf)
      [11, 13] mdPack(key=link,data={"href":"assets/report.pdf","title":""}) + mdMark
      [13, 30] mdPack(key=link,data={"href":"assets/report.pdf","title":""}) + mdLinkUri
      [30, 31] mdPack(key=link,data={"href":"assets/report.pdf","title":""}) + mdMark
      "
    `)
  })

  it('names an empty label after the href basename', () => {
    expect(parse('[](assets/q3%20report.pdf)', { resolveFileLink: claimAssets }))
      .toMatchInlineSnapshot(`
      "
      [0, 26] mdFile(href=assets/q3%20report.pdf,name=q3 report.pdf)
      "
    `)
  })

  it('strips query and hash from the basename', () => {
    expect(parse('[](assets/report.pdf?v=2#page)', { resolveFileLink: claimAssets }))
      .toMatchInlineSnapshot(`
      "
      [0, 30] mdFile(href=assets/report.pdf?v=2#page,name=report.pdf)
      "
    `)
  })

  it('keeps the raw segment when decoding fails', () => {
    expect(parse('[](assets/%E0%A4%A.pdf)', { resolveFileLink: claimAssets }))
      .toMatchInlineSnapshot(`
      "
      [0, 23] mdFile(href=assets/%E0%A4%A.pdf,name=%E0%A4%A.pdf)
      "
    `)
  })

  it('keeps a nested label as its raw slice', () => {
    expect(parse('[**final** report.pdf](assets/report.pdf)', { resolveFileLink: claimAssets }))
      .toMatchInlineSnapshot(`
      "
      [0, 41] mdFile(href=assets/report.pdf,name=**final** report.pdf)
      "
    `)
  })

  it('passes the title through', () => {
    expect(parse('[report.pdf](assets/report.pdf "Quarterly")', { resolveFileLink: claimAssets }))
      .toMatchInlineSnapshot(`
      "
      [0, 43] mdFile(href=assets/report.pdf,name=report.pdf,title=Quarterly)
      "
    `)
  })

  it('claims only what the resolver claims in mixed content', () => {
    expect(
      parse('see [report.pdf](assets/report.pdf) and [docs](https://example.com)', {
        resolveFileLink: claimAssets,
      }),
    ).toMatchInlineSnapshot(`
      "
      [0, 4]
      [4, 35]  mdFile(href=assets/report.pdf,name=report.pdf)
      [35, 40]
      [40, 41] mdPack(key=link,data={"href":"https://example.com","title":""}) + mdLinkText(href=https://example.com) + mdMark
      [41, 45] mdPack(key=link,data={"href":"https://example.com","title":""}) + mdLinkText(href=https://example.com)
      [45, 47] mdPack(key=link,data={"href":"https://example.com","title":""}) + mdMark
      [47, 66] mdPack(key=link,data={"href":"https://example.com","title":""}) + mdLinkUri
      [66, 67] mdPack(key=link,data={"href":"https://example.com","title":""}) + mdMark
      "
    `)
  })

  it('keeps parent marks inside emphasis', () => {
    expect(parse('*[report.pdf](assets/report.pdf)*', { resolveFileLink: claimAssets }))
      .toMatchInlineSnapshot(`
      "
      [0, 1]   mdPack(key=italic) + mdEm + mdMark
      [1, 32]  mdPack(key=italic) + mdEm + mdFile(href=assets/report.pdf,name=report.pdf)
      [32, 33] mdPack(key=italic) + mdEm + mdMark
      "
    `)
  })

  it('never consults the resolver for images, autolinks, or linkless shapes', () => {
    const resolveFileLink = vi.fn(() => true)
    parse('![img](assets/img.pdf)', { resolveFileLink })
    parse('www.example.com/file.pdf', { resolveFileLink })
    parse('[shortcut]', { resolveFileLink })
    parse('[empty]()', { resolveFileLink })
    expect(resolveFileLink).not.toHaveBeenCalled()
  })
})
