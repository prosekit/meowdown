import { describe, expect, it } from 'vitest'

import { type InlineElement, parseInline } from './inline.ts'
import { LEZER_NODE_IDS } from './node-ids.ts'

function findWikiEmbeds(text: string): string[] {
  const embeds: string[] = []
  const walk = (elements: readonly InlineElement[]): void => {
    for (const element of elements) {
      if (element.type === LEZER_NODE_IDS.WikiEmbed) {
        embeds.push(text.slice(element.from, element.to))
      }
      walk(element.children)
    }
  }
  walk(parseInline(text))
  return embeds
}

describe('wiki embed inline parser', () => {
  it.each([
    '![[image.png]]',
    '![[folder/image.png|320]]',
    '![[folder/image.png|320x200]]',
    '![[Note#Heading]]',
    '![[Note|Alias]]',
    'before ![[日本語/画像.png]] after',
  ])('recognizes %s', (input) => {
    expect(findWikiEmbeds(input)).toEqual([input.match(/!\[\[.*?\]\]/)?.[0]])
  })

  it.each([
    '![[ ]]',
    '![[\t]]',
    '![[target]',
    '![[a]b]]',
    '![[a\nb]]',
    String.raw`\![[image.png]]`,
    '`![[image.png]]`',
    '[[ordinary]]',
  ])('rejects %s', (input) => {
    expect(findWikiEmbeds(input)).toEqual([])
  })

  it('produces a WikiEmbed with source-mark children', () => {
    const [embed] = parseInline('![[image.png|320]]')
    expect(embed?.type).toBe(LEZER_NODE_IDS.WikiEmbed)
    expect(embed?.children.map((child) => child.type)).toEqual([
      LEZER_NODE_IDS.WikiEmbedMark,
      LEZER_NODE_IDS.WikiEmbedMark,
    ])
  })
})
