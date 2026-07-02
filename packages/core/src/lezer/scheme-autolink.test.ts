import { describe, expect, it } from 'vitest'

import { collectInlineElements, parseInline } from './inline.ts'
import { LEZER_NODE_IDS } from './node-ids.ts'
import { schemeAutolink } from './scheme-autolink.ts'

/** Every `URL` node the parser emits for `text`, as `[from, to, slice]`. */
function urls(
  text: string,
  autolinkSchemes: string[] = ['reflect'],
): Array<[number, number, string]> {
  const elements = parseInline(text, autolinkSchemes)
  const nodes = collectInlineElements(elements, (node) => node.type === LEZER_NODE_IDS.URL)
  return nodes.map((node) => [node.from, node.to, text.slice(node.from, node.to)])
}

describe('schemeAutolink', () => {
  describe('detects a configured scheme URL', () => {
    it('at the start of the text', () => {
      expect(urls('reflect://today')).toEqual([[0, 15, 'reflect://today']])
    })

    it('after whitespace', () => {
      expect(urls('open reflect://today now')).toEqual([[5, 20, 'reflect://today']])
    })

    it('right after an opening paren', () => {
      expect(urls('(reflect://today)')).toEqual([[1, 16, 'reflect://today']])
    })

    it('with a path, query, and fragment', () => {
      expect(urls('reflect://note/abc?x=1#top')).toEqual([[0, 26, 'reflect://note/abc?x=1#top']])
    })

    it('with an uppercase scheme', () => {
      expect(urls('Reflect://today')).toEqual([[0, 15, 'Reflect://today']])
    })

    it('for each of multiple configured schemes', () => {
      expect(urls('obsidian://open and reflect://today', ['reflect', 'obsidian'])).toEqual([
        [0, 15, 'obsidian://open'],
        [20, 35, 'reflect://today'],
      ])
    })
  })

  describe('ignores text that is not a configured scheme URL', () => {
    it('an unconfigured scheme', () => {
      expect(urls('notes://today')).toEqual([])
    })

    it('a configured scheme without the default parse opting in', () => {
      expect(parseInline('reflect://today').some((node) => node.type === LEZER_NODE_IDS.URL)).toBe(
        false,
      )
    })

    it('a scheme with an empty rest', () => {
      expect(urls('reflect://')).toEqual([])
      expect(urls('reflect:// and text')).toEqual([])
    })

    it('a scheme mid-word', () => {
      expect(urls('xreflect://today')).toEqual([])
    })

    it('a scheme that only prefixes the configured one', () => {
      expect(urls('ref://today')).toEqual([])
    })
  })

  describe('trims trailing punctuation', () => {
    it('drops a sentence-ending period', () => {
      expect(urls('Open reflect://today.')).toEqual([[5, 20, 'reflect://today']])
    })

    it('drops a trailing comma', () => {
      expect(urls('reflect://today, then more')).toEqual([[0, 15, 'reflect://today']])
    })

    it('drops an unbalanced closing paren', () => {
      expect(urls('(reflect://today)')).toEqual([[1, 16, 'reflect://today']])
    })

    it('keeps balanced parens inside the path', () => {
      expect(urls('reflect://foo(bar)')).toEqual([[0, 18, 'reflect://foo(bar)']])
    })

    it('does not link a rest that trims away entirely', () => {
      expect(urls('reflect://.')).toEqual([])
    })
  })

  describe('coexists with the other autolinks', () => {
    it('leaves an https URL to GFM', () => {
      expect(urls('https://example.com and reflect://today')).toEqual([
        [0, 19, 'https://example.com'],
        [24, 39, 'reflect://today'],
      ])
    })

    it('leaves a bare domain to the bare autolink', () => {
      expect(urls('google.com and reflect://today')).toEqual([
        [0, 10, 'google.com'],
        [15, 30, 'reflect://today'],
      ])
    })

    it('does not link the label of an explicit link', () => {
      expect(urls('[reflect://today](http://x)')).toEqual([[18, 26, 'http://x']])
    })

    it('does not link inside inline code', () => {
      expect(urls('`reflect://today`')).toEqual([])
    })
  })

  describe('rejects an invalid scheme at configuration time', () => {
    for (const scheme of ['reflect://', '1reflect', 're flect', '']) {
      it(JSON.stringify(scheme), () => {
        expect(() => schemeAutolink([scheme])).toThrow(RangeError)
      })
    }
  })
})
