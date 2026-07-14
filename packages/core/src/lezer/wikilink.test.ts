import dedent from 'dedent'
import { describe, expect, it } from 'vitest'

import { type InlineElement, parseInline } from './inline.ts'
import { LEZER_NODE_IDS } from './node-ids.ts'
import { gfmBlockOnlyParser } from './parser.ts'

/** Every `[[target]]` slice in the inline element tree, in document order. */
function findWikilinks(text: string): string[] {
  const links: string[] = []
  const walk = (elements: readonly InlineElement[]): void => {
    for (const element of elements) {
      if (element.type === LEZER_NODE_IDS.Wikilink) {
        links.push(text.slice(element.from, element.to))
      }
      walk(element.children)
    }
  }
  walk(parseInline(text))
  return links
}

/** Render an inline element tree into an indented, human-readable string. */
function formatTree(text: string): string {
  const nameById = new Map(Object.entries(LEZER_NODE_IDS).map(([name, id]) => [id, name]))
  const format = (element: InlineElement, depth: number): string => {
    const indent = '  '.repeat(depth)
    const name = nameById.get(element.type) ?? `#${element.type}`
    const slice = JSON.stringify(text.slice(element.from, element.to))
    const head = `${indent}${name} [${element.from}, ${element.to}] ${slice}`
    const children = element.children.map((child) => format(child, depth + 1))
    return [head, ...children].join('\n')
  }
  return parseInline(text)
    .map((element) => format(element, 0))
    .join('\n')
}

describe('wikilink inline parser', () => {
  describe('recognizes', () => {
    const cases: ReadonlyArray<[input: string, links: string[]]> = [
      ['[[note]]', ['[[note]]']],
      ['a [[note]] b', ['[[note]]']],
      ['[[note]] starts', ['[[note]]']],
      ['ends with [[note]]', ['[[note]]']],
      ['[[note with spaces]]', ['[[note with spaces]]']],
      ['[[a]]', ['[[a]]']],
      ['[[ a ]]', ['[[ a ]]']],
      ['foo[[note]]', ['[[note]]']],
      ['[[a]] [[b]]', ['[[a]]', '[[b]]']],
      ['[[a]][[b]]', ['[[a]]', '[[b]]']],
      ['[[#heading]]', ['[[#heading]]']],
      ['[[note#section]]', ['[[note#section]]']],
      ['[[a|b]]', ['[[a|b]]']],
      ['[[日本語ノート]]', ['[[日本語ノート]]']],
      [`[[note's "x" & y.]]`, [`[[note's "x" & y.]]`]],
      ['*em [[note]] x*', ['[[note]]']],
      ['**strong [[note]] x**', ['[[note]]']],
      ['a\t[[note]]', ['[[note]]']],
      ['Title [[note]]', ['[[note]]']],
      ['#tag [[note]]', ['[[note]]']],
    ]
    for (const [input, links] of cases) {
      it(`${JSON.stringify(input)} -> ${links.join(' ')}`, () => {
        expect(findWikilinks(input)).toEqual(links)
      })
    }
  })

  describe('rejects', () => {
    const cases: readonly string[] = [
      '[[]]',
      '[[ ]]',
      '[[\t]]',
      '[[a',
      '[[a]',
      '[a]]',
      '[a]',
      '[[a]b]]', // single `]` inside the target
      '[[a\nb]]', // no multiline targets
      String.raw`\[[note]]`, // Escape claims `\[`
      '`[[code]]`', // InlineCode claims the span
      '<a title="[[x]]">', // HTMLTag claims the span
      'http://x.test/[[y]]', // Autolink swallows the whole URL
      '![[embed]]', // `![` claims first; becomes Image
    ]
    for (const input of cases) {
      it(JSON.stringify(input), () => {
        expect(findWikilinks(input)).toEqual([])
      })
    }
  })

  describe('precedence and partial matches', () => {
    const cases: ReadonlyArray<[input: string, links: string[]]> = [
      ['[[[x]]', ['[[x]]']], // first `[[` fails on `[`, second wins
      ['[[x]]]', ['[[x]]']], // closes at the first `]]`
      ['[[a [[b]]', ['[[b]]']],
      ['[[a]] b]]', ['[[a]]']],
      ['[[x]](url)', ['[[x]]']], // `(url)` stays plain text
      ['[see [[x]]](http://y)', ['[[x]]']], // nested inside a Link label
      ['[[note #tag]]', ['[[note #tag]]']],
    ]
    for (const [input, links] of cases) {
      it(`${JSON.stringify(input)} -> ${links.join(' ')}`, () => {
        expect(findWikilinks(input)).toEqual(links)
      })
    }

    it('never produces a Hashtag inside a wikilink', () => {
      const elements = parseInline('[[note #tag]]')
      const hasHashtag = (els: readonly InlineElement[]): boolean =>
        els.some((el) => el.type === LEZER_NODE_IDS.Hashtag || hasHashtag(el.children))
      expect(hasHashtag(elements)).toBe(false)
    })
  })

  it('produces a Wikilink with two WikilinkMark children', () => {
    expect(formatTree('a [[note]] b')).toMatchInlineSnapshot(`
      """
      Wikilink [2, 10] "[[note]]"
        WikilinkMark [2, 4] "[["
        WikilinkMark [8, 10] "]]"
      """
    `)
  })

  it('parses ![[embed]] as an Image, not a Wikilink', () => {
    expect(formatTree('![[embed]]')).toMatchInlineSnapshot(`
      """
      Image [0, 10] "![[embed]]"
        LinkMark [0, 2] "!["
        Link [2, 9] "[embed]"
          LinkMark [2, 3] "["
          LinkMark [8, 9] "]"
        LinkMark [9, 10] "]"
      """
    `)
  })

  it('is never produced by gfmBlockOnlyParser', () => {
    const markdown = dedent`
      hello [[note]]

      # heading [[x]]
    `
    const tree = gfmBlockOnlyParser.parse(markdown)
    let sawWikilink = false
    tree.iterate({
      enter(node) {
        if (node.type.id === LEZER_NODE_IDS.Wikilink) sawWikilink = true
      },
    })
    expect(sawWikilink).toBe(false)
  })
})
