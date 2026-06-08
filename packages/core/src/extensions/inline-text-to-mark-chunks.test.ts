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
})
