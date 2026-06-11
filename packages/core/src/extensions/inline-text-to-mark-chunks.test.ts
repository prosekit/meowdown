import type { Schema } from '@prosekit/pm/model'
import { beforeAll, describe, expect, it } from 'vitest'

import { defineEditorExtension } from './extension.ts'
import { inlineTextToMarkChunks } from './inline-text-to-mark-chunks.ts'
import type { MarkChunk } from './mark-chunk.ts'

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
  let schema: Schema

  beforeAll(() => {
    schema = defineEditorExtension().schema!
  })

  it('plain text returns no chunks (no marks anywhere)', () => {
    const chunks = inlineTextToMarkChunks(schema, 'hello world')
    // Pure text has no inline nodes; the implementation does not emit
    // a "no-mark" gap when the entire range is plain.
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-11: -
      "
    `)
  })

  it('emphasis yields gap + mark + content + mark', () => {
    const chunks = inlineTextToMarkChunks(schema, 'Hello *world*')
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
    const chunks = inlineTextToMarkChunks(schema, 'a **bold** b')
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
    const chunks = inlineTextToMarkChunks(schema, 'a `c` b')
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
    const chunks = inlineTextToMarkChunks(schema, 'a ~~b~~ c')
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
    const chunks = inlineTextToMarkChunks(schema, 'see [docs](http://x) now')
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
    const chunks = inlineTextToMarkChunks(schema, '[*ital*](http://x)')
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

  it('nested emphasis inside strong (***foo***)', () => {
    const chunks = inlineTextToMarkChunks(schema, '***foo***')
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
    const chunks = inlineTextToMarkChunks(schema, '*a***b**')
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
    const chunks = inlineTextToMarkChunks(schema, '*a* mid *b*')
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
    const chunks = inlineTextToMarkChunks(schema, '*all*')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-1: mdEm + mdMark
      1-4: mdEm
      4-5: mdEm + mdMark
      "
    `)
  })

  it('empty input returns no chunks', () => {
    expect(inlineTextToMarkChunks(schema, '')).toEqual([])
  })

  it('escape characters produce no marks (visible literal text)', () => {
    const chunks = inlineTextToMarkChunks(schema, String.raw`\*not\*`)
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-7: -
      "
    `)
  })

  it('hard break produces no mark', () => {
    const chunks = inlineTextToMarkChunks(schema, 'a  \nb')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-5: -
      "
    `)
  })

  it('tag yields a single mdTag chunk covering the # too', () => {
    const chunks = inlineTextToMarkChunks(schema, 'a #meow b')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: -
      2-7: mdTag
      7-9: -
      "
    `)
  })

  it('two tags', () => {
    const chunks = inlineTextToMarkChunks(schema, '#a #b')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: mdTag
      2-3: -
      3-5: mdTag
      "
    `)
  })

  it('tag inside emphasis', () => {
    const chunks = inlineTextToMarkChunks(schema, '*x #tag y*')
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
    const chunks = inlineTextToMarkChunks(schema, '[see #tag](http://x)')
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
    const chunks = inlineTextToMarkChunks(schema, '# heading text')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-14: -
      "
    `)
  })

  it('all-digit tag produces no mark', () => {
    const chunks = inlineTextToMarkChunks(schema, "we're #1")
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-8: -
      "
    `)
  })

  it('wikilink yields mdMark brackets around an mdWikilink target', () => {
    const chunks = inlineTextToMarkChunks(schema, 'a [[note]] b')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: -
      2-4: mdMark + mdWikilink
      4-8: mdWikilink
      8-10: mdMark + mdWikilink
      10-12: -
      "
    `)
  })

  it('adjacent wikilinks coalesce the middle ]][[ into one chunk', () => {
    const chunks = inlineTextToMarkChunks(schema, '[[a]][[b]]')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: mdMark + mdWikilink
      2-3: mdWikilink
      3-7: mdMark + mdWikilink
      7-8: mdWikilink
      8-10: mdMark + mdWikilink
      "
    `)
  })

  it('wikilink inside emphasis', () => {
    const chunks = inlineTextToMarkChunks(schema, '*x [[n]] y*')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-1: mdEm + mdMark
      1-3: mdEm
      3-5: mdEm + mdMark + mdWikilink
      5-6: mdEm + mdWikilink
      6-8: mdEm + mdMark + mdWikilink
      8-10: mdEm
      10-11: mdEm + mdMark
      "
    `)
  })

  it('wikilink inside a link label', () => {
    const chunks = inlineTextToMarkChunks(schema, '[see [[x]]](http://y)')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-1: mdLinkText(href=http://y) + mdMark
      1-5: mdLinkText(href=http://y)
      5-7: mdLinkText(href=http://y) + mdMark + mdWikilink
      7-8: mdLinkText(href=http://y) + mdWikilink
      8-10: mdLinkText(href=http://y) + mdMark + mdWikilink
      10-12: mdMark
      12-20: mdLinkUri
      20-21: mdMark
      "
    `)
  })

  it('no mdTag inside a wikilink target', () => {
    const chunks = inlineTextToMarkChunks(schema, '[[note #tag]]')
    expect(foramtMarkChunks(chunks)).toMatchInlineSnapshot(`
      "
      0-2: mdMark + mdWikilink
      2-11: mdWikilink
      11-13: mdMark + mdWikilink
      "
    `)
  })

  it('unclosed wikilink falls back to link parsing of the inner [a]', () => {
    // No mdWikilink anywhere; the inner `[a]` becomes a shortcut
    // reference link (pre-existing lezer behavior).
    const chunks = inlineTextToMarkChunks(schema, '[[a]')
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
