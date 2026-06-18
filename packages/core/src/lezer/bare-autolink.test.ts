import { describe, expect, it } from 'vitest'

import { collectInlineElements, parseInline } from './inline.ts'
import { LEZER_NODE_IDS } from './node-ids.ts'

/** Every `URL` node the parser emits for `text`, as `[from, to, slice]`. */
function urls(text: string): Array<[number, number, string]> {
  const elements = parseInline(text)
  const nodes = collectInlineElements(elements, (node) => node.type === LEZER_NODE_IDS.URL)
  return nodes.map((node) => [node.from, node.to, text.slice(node.from, node.to)])
}

describe('bareAutolink', () => {
  describe('detects a bare domain', () => {
    it('at the start of the text', () => {
      expect(urls('google.com')).toEqual([[0, 10, 'google.com']])
    })

    it('after whitespace', () => {
      expect(urls('visit google.com now')).toEqual([[6, 16, 'google.com']])
    })

    it('with a subdomain and a path', () => {
      expect(urls('sub.domain.com/path?q=1')).toEqual([[0, 23, 'sub.domain.com/path?q=1']])
    })

    it('right after an opening paren', () => {
      expect(urls('(google.com)')).toEqual([[1, 11, 'google.com']])
    })
  })

  describe('ignores text that is not a linkable bare domain', () => {
    for (const text of [
      'node.js',
      'README.md',
      'deploy.sh',
      'file.txt',
      'i.e.',
      't.co',
      '1.2.3.4',
      'v1.2',
    ]) {
      it(text, () => {
        expect(urls(text)).toEqual([])
      })
    }
  })

  describe('trims trailing punctuation', () => {
    it('drops a sentence-ending period', () => {
      expect(urls('Visit google.com.')).toEqual([[6, 16, 'google.com']])
    })

    it('drops a trailing comma', () => {
      expect(urls('google.com, then more')).toEqual([[0, 10, 'google.com']])
    })

    it('drops an unbalanced closing paren', () => {
      expect(urls('(google.com/foo)')).toEqual([[1, 15, 'google.com/foo']])
    })

    it('keeps balanced parens inside the path', () => {
      expect(urls('google.com/foo(bar)')).toEqual([[0, 19, 'google.com/foo(bar)']])
    })

    it('drops a trailing entity reference', () => {
      expect(urls('google.com/a&amp;')).toEqual([[0, 12, 'google.com/a']])
    })
  })

  describe('does not start mid-token or re-split other autolinks', () => {
    it('treats an @ host as an email, not a bare domain', () => {
      expect(urls('a@google.com')).toEqual([[0, 12, 'a@google.com']])
    })

    it('leaves a www. autolink as a single URL', () => {
      expect(urls('www.example.com')).toEqual([[0, 15, 'www.example.com']])
    })

    it('leaves a scheme autolink as a single URL', () => {
      expect(urls('https://example.com')).toEqual([[0, 19, 'https://example.com']])
    })

    it('does not link the label of an explicit link', () => {
      expect(urls('[google.com](http://x)')).toEqual([[13, 21, 'http://x']])
    })

    it('does not link inside inline code', () => {
      expect(urls('`google.com`')).toEqual([])
    })

    it('does not link inside a wikilink', () => {
      expect(urls('[[google.com]]')).toEqual([])
    })
  })
})
