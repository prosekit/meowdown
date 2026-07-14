import type { MarkdownConfig } from '@lezer/markdown'

import {
  CHAR_EXCLAMATION_MARK,
  CHAR_LEFT_SQUARE_BRACKET,
  CHAR_LINE_FEED,
  CHAR_RIGHT_SQUARE_BRACKET,
  CHAR_SPACE,
  CHAR_TAB,
} from '../unicode.ts'

/**
 * Inline parser for Obsidian-style wiki embeds (`![[target]]`). The target is
 * deliberately kept opaque here; classification and optional size parsing
 * happen at the host boundary in `parseWikiEmbed`.
 */
export const wikiEmbed: MarkdownConfig = {
  defineNodes: [{ name: 'WikiEmbed' }, { name: 'WikiEmbedMark' }],
  parseInline: [
    {
      name: 'WikiEmbed',
      before: 'Link',
      parse(cx, next, pos) {
        if (
          next !== CHAR_EXCLAMATION_MARK ||
          cx.char(pos + 1) !== CHAR_LEFT_SQUARE_BRACKET ||
          cx.char(pos + 2) !== CHAR_LEFT_SQUARE_BRACKET
        ) {
          return -1
        }

        let hasContent = false
        for (let index = pos + 3; index < cx.end - 1; index++) {
          const code = cx.char(index)
          if (code === CHAR_RIGHT_SQUARE_BRACKET) {
            if (cx.char(index + 1) !== CHAR_RIGHT_SQUARE_BRACKET || !hasContent) return -1
            const end = index + 2
            return cx.addElement(
              cx.elt('WikiEmbed', pos, end, [
                cx.elt('WikiEmbedMark', pos, pos + 3),
                cx.elt('WikiEmbedMark', index, end),
              ]),
            )
          }
          if (code === CHAR_LEFT_SQUARE_BRACKET || code === CHAR_LINE_FEED) return -1
          if (code !== CHAR_SPACE && code !== CHAR_TAB) hasContent = true
        }
        return -1
      },
    },
  ],
}
