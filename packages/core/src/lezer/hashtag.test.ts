import dedent from 'dedent'
import { describe, expect, it } from 'vitest'

import { type InlineElement, parseInline } from './inline.ts'
import { LEZER_NODE_IDS } from './node-ids.ts'
import { gfmBlockOnlyParser } from './parser.ts'

/** Every `#tag` slice in the inline element tree, in document order. */
function findTags(text: string): string[] {
  const tags: string[] = []
  const walk = (elements: readonly InlineElement[]): void => {
    for (const element of elements) {
      if (element.type === LEZER_NODE_IDS.Hashtag) {
        tags.push(text.slice(element.from, element.to))
      }
      walk(element.children)
    }
  }
  walk(parseInline(text))
  return tags
}

describe('hashtag inline parser', () => {
  describe('recognizes', () => {
    const cases: ReadonlyArray<[input: string, tags: string[]]> = [
      ['#meow', ['#meow']],
      ['a #meow', ['#meow']],
      ['#meow b', ['#meow']],
      ['a #meow b', ['#meow']],
      ['#MeOw', ['#MeOw']],
      ['#a', ['#a']],
      ['#a1', ['#a1']],
      ['#1a', ['#1a']],
      ['#v2', ['#v2']],
      ['#my-tag', ['#my-tag']],
      ['#my_tag', ['#my_tag']],
      ['#tag-', ['#tag-']],
      ['#tag_', ['#tag_']],
      ['#a-b_c1', ['#a-b_c1']],
      ['#日本語', ['#日本語']],
      ['#café', ['#café']],
      ['#тег', ['#тег']],
      ['a\t#x', ['#x']],
      ['a\n#x', ['#x']],
      ['#a #b', ['#a', '#b']],
      ['#one mid #two', ['#one', '#two']],
      ['see *the #tag here*', ['#tag']],
      ['see **the #tag here**', ['#tag']],
      ['[see #tag](http://x)', ['#tag']],
      ['Title #tag', ['#tag']],
    ]
    for (const [input, tags] of cases) {
      it(`${JSON.stringify(input)} -> ${tags.join(' ')}`, () => {
        expect(findTags(input)).toEqual(tags)
      })
    }
  })

  describe('rejects', () => {
    const cases: readonly string[] = [
      '#',
      '# heading',
      '#123',
      '#2024',
      '#_',
      '#-',
      '#__--',
      'abc#def',
      'a#b',
      '(#tag)',
      '"#tag"',
      '*#tag*',
      '**#tag**',
      '##tag',
      '#🐱',
      String.raw`\#tag`, // Escape claims `\#`
      '`#tag`', // InlineCode claims the span
      '<a href="#x">', // HTMLTag claims the span
      'http://example.com/#frag', // Autolink claims the span
      '[#tag](http://x)', // preceded by `[`
    ]
    for (const input of cases) {
      it(JSON.stringify(input), () => {
        expect(findTags(input)).toEqual([])
      })
    }
  })

  describe('stops at the first non-tag character', () => {
    const cases: ReadonlyArray<[input: string, tags: string[]]> = [
      ['#a#b', ['#a']],
      ['#tag.', ['#tag']],
      ['#tag,', ['#tag']],
      ['#tag!?;:', ['#tag']],
      ['#tag*em*', ['#tag']],
      ['#café!', ['#café']],
      ['#a🐱', ['#a']],
    ]
    for (const [input, tags] of cases) {
      it(`${JSON.stringify(input)} -> ${tags.join(' ')}`, () => {
        expect(findTags(input)).toEqual(tags)
      })
    }
  })

  it('nests inside emphasis with exact offsets', () => {
    const text = '*a #tag b*'
    const emphasis = parseInline(text)[0]
    expect(emphasis.type).toBe(LEZER_NODE_IDS.Emphasis)
    const tag = emphasis.children.find((child) => child.type === LEZER_NODE_IDS.Hashtag)
    expect(tag).toBeDefined()
    expect([tag!.from, tag!.to]).toEqual([3, 7])
    expect(tag!.children).toEqual([])
  })

  it('is never produced by gfmBlockOnlyParser', () => {
    const markdown = dedent`
      hello #meow

      # heading #tag
    `
    const tree = gfmBlockOnlyParser.parse(markdown)
    let sawHashtag = false
    tree.iterate({
      enter(node) {
        if (node.type.id === LEZER_NODE_IDS.Hashtag) sawHashtag = true
      },
    })
    expect(sawHashtag).toBe(false)
  })
})
