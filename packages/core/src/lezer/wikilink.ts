import type { MarkdownConfig } from '@lezer/markdown'

import {
  CHAR_LEFT_SQUARE_BRACKET,
  CHAR_LINE_FEED,
  CHAR_RIGHT_SQUARE_BRACKET,
  CHAR_SPACE,
  CHAR_TAB,
} from '../unicode.ts'

/**
 * Inline parser for `[[target]]`: any chars except `[`, `]` and
 * newline, at least one of them not a space/tab. The first `]` must
 * pair into `]]`. Registered before `Link` and claims the whole
 * element eagerly, so the target is atom: no nested markdown, no
 * tags.
 */
export const wikilink: MarkdownConfig = {
  defineNodes: [{ name: 'Wikilink' }, { name: 'WikilinkMark' }],
  parseInline: [
    {
      name: 'Wikilink',
      before: 'Link',
      parse(cx, next, pos) {
        if (next !== CHAR_LEFT_SQUARE_BRACKET || cx.char(pos + 1) !== CHAR_LEFT_SQUARE_BRACKET) {
          return -1
        }
        let hasContent = false
        for (let i = pos + 2; i < cx.end - 1; i++) {
          const code = cx.char(i)
          if (code === CHAR_RIGHT_SQUARE_BRACKET) {
            if (cx.char(i + 1) !== CHAR_RIGHT_SQUARE_BRACKET || !hasContent) return -1
            const end = i + 2
            return cx.addElement(
              cx.elt('Wikilink', pos, end, [
                cx.elt('WikilinkMark', pos, pos + 2),
                cx.elt('WikilinkMark', i, end),
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
