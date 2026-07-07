import { describe, expect, it } from 'vitest'

import { collectInlineElements, parseInline } from './inline.ts'
import { LEZER_NODE_IDS } from './node-ids.ts'

/** Every `URL` node the parser emits for `text`, as `[from, to, slice]`. */
function urls(text: string): Array<[number, number, string]> {
  const elements = parseInline(text)
  const nodes = collectInlineElements(elements, (node) => node.type === LEZER_NODE_IDS.URL)
  return nodes.map((node) => [node.from, node.to, text.slice(node.from, node.to)])
}

describe('schemeAutolink', () => {
  describe('detects a bare custom-scheme URI', () => {
    it('at the start of the text', () => {
      expect(urls('x-cutsom-schema://ABCD-1234')).toEqual([[0, 27, 'x-cutsom-schema://ABCD-1234']])
    })

    it('after whitespace', () => {
      expect(urls('open x-cutsom-schema://sub?key=value now')).toEqual([
        [5, 36, 'x-cutsom-schema://sub?key=value'],
      ])
    })

    it('with an uppercase scheme', () => {
      expect(urls('X-Custom-Schema://abc')).toEqual([[0, 21, 'X-Custom-Schema://abc']])
    })

    it('with digits and plus in the scheme', () => {
      expect(urls('web+app://thing and s3://bucket/key')).toEqual([
        [0, 15, 'web+app://thing'],
        [20, 35, 's3://bucket/key'],
      ])
    })

    it('right after an opening paren', () => {
      expect(urls('(note://abc)')).toEqual([[1, 11, 'note://abc']])
    })

    it('picks up scheme URLs that GFM Autolink declines', () => {
      expect(urls('https://localhost:3000')).toEqual([[0, 22, 'https://localhost:3000']])
    })
  })

  describe('ignores text that is not a linkable scheme URI', () => {
    for (const text of [
      'note://', // no tail
      'note:// then words', // tail must be adjacent
      'note:target', // no `//`
      'word:note://x', // mid-word (after `:`)
      '1note://x', // scheme must start with a letter
    ]) {
      it(text, () => {
        expect(urls(text)).toEqual([])
      })
    }
  })

  describe('trims trailing punctuation', () => {
    it('drops a sentence-ending period', () => {
      expect(urls('See note://abc.')).toEqual([[4, 14, 'note://abc']])
    })

    it('drops a trailing comma', () => {
      expect(urls('note://abc, then more')).toEqual([[0, 10, 'note://abc']])
    })

    it('drops an unbalanced closing paren', () => {
      expect(urls('(see note://abc)')).toEqual([[5, 15, 'note://abc']])
    })

    it('keeps balanced parens inside the tail', () => {
      expect(urls('note://abc(1)')).toEqual([[0, 13, 'note://abc(1)']])
    })

    it('declines when trimming leaves no tail', () => {
      expect(urls('note://...')).toEqual([])
    })
  })

  describe('leaves GFM-claimed shapes and other contexts alone', () => {
    it('keeps the GFM end rule for an http URL (query needs a path)', () => {
      expect(urls('https://example.com?q=1')).toEqual([[0, 19, 'https://example.com']])
    })

    it('leaves a mailto autolink to GFM', () => {
      expect(urls('mailto:a@google.com')).toEqual([[0, 19, 'mailto:a@google.com']])
    })

    it('does not link the label of an explicit link', () => {
      expect(urls('[note://x](http://y)')).toEqual([[11, 19, 'http://y']])
    })

    it('does not link inside inline code', () => {
      expect(urls('`note://abc`')).toEqual([])
    })

    it('does not link inside a wikilink', () => {
      expect(urls('[[note://abc]]')).toEqual([])
    })
  })
})
