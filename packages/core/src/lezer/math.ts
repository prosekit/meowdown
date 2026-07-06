import type { MarkdownConfig } from '@lezer/markdown'

import {
  CHAR_0,
  CHAR_9,
  CHAR_BACKWARD_SLASH,
  CHAR_DOLLAR,
  CHAR_LINE_FEED,
  isSpaceChar,
} from '../unicode.ts'

function isDigit(code: number): boolean {
  return code >= CHAR_0 && code <= CHAR_9
}

/**
 * Inline parser for `$x$` and `$$x$$` TeX math, following Pandoc-style
 * delimiter rules: the opening and closing runs must have the same length (1
 * or 2 dollars), the content must not start or end with a space, the closing
 * run must not be followed by a digit (so `$20,000 and $30,000` stays plain
 * text), and the whole expression stays on one line. A backslash-escaped `\$`
 * inside the content does not close. Runs are greedy: an opener preceded by
 * another dollar never starts a new expression, and the first closing
 * candidate decides: if it is invalid the whole expression fails, so an
 * unpaired dollar never scans across the rest of the line. Claims the
 * element eagerly, so the content is atomic: no nested markdown.
 */
export const math: MarkdownConfig = {
  defineNodes: [{ name: 'InlineMath' }, { name: 'InlineMathMark' }],
  parseInline: [
    {
      name: 'InlineMath',
      after: 'InlineCode',
      parse(cx, next, pos) {
        if (next !== CHAR_DOLLAR || cx.char(pos - 1) === CHAR_DOLLAR) return -1
        const delimLength = cx.char(pos + 1) === CHAR_DOLLAR ? 2 : 1
        if (cx.char(pos + delimLength) === CHAR_DOLLAR) return -1
        const contentFrom = pos + delimLength
        if (isSpaceChar(cx.char(contentFrom))) return -1
        for (let i = contentFrom; i < cx.end; i++) {
          const code = cx.char(i)
          if (code === CHAR_LINE_FEED) return -1
          if (code === CHAR_BACKWARD_SLASH) {
            i++
            continue
          }
          if (code !== CHAR_DOLLAR) continue
          let closeLength = 1
          while (cx.char(i + closeLength) === CHAR_DOLLAR) closeLength++
          if (
            closeLength !== delimLength ||
            isSpaceChar(cx.char(i - 1)) ||
            isDigit(cx.char(i + closeLength))
          ) {
            return -1
          }
          const end = i + closeLength
          return cx.addElement(
            cx.elt('InlineMath', pos, end, [
              cx.elt('InlineMathMark', pos, contentFrom),
              cx.elt('InlineMathMark', i, end),
            ]),
          )
        }
        return -1
      },
    },
  ],
}
