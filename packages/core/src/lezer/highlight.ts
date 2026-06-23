import type { MarkdownConfig } from '@lezer/markdown'

import { CHAR_EQUAL } from '../unicode.ts'

const HighlightDelim = { resolve: 'Highlight', mark: 'HighlightMark' }

/**
 * CommonMark punctuation class, copied from `@lezer/markdown`'s own
 * `Punctuation` regex so highlight flanking decisions match GFM strikethrough.
 */
const PUNCTUATION = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~\u{A1}\u{2010}-\u{2027}]/u

/**
 * Inline parser for `==text==` highlight. Emits a `Highlight` node wrapping the
 * content, with `HighlightMark` runs for the `==` delimiters, mirroring GFM
 * `Strikethrough`. It reuses strikethrough's whitespace/punctuation flanking
 * rules so a space-flanked `== ` never opens a highlight (a lone `a == b` stays
 * literal), and refuses a third `=` so `===` runs are not consumed.
 */
export const highlight: MarkdownConfig = {
  defineNodes: [{ name: 'Highlight' }, { name: 'HighlightMark' }],
  parseInline: [
    {
      name: 'Highlight',
      after: 'Emphasis',
      parse(cx, next, pos) {
        if (
          next !== CHAR_EQUAL ||
          cx.char(pos + 1) !== CHAR_EQUAL ||
          cx.char(pos + 2) === CHAR_EQUAL
        ) {
          return -1
        }
        const before = cx.slice(pos - 1, pos)
        const after = cx.slice(pos + 2, pos + 3)
        const spaceBefore = /\s|^$/.test(before)
        const spaceAfter = /\s|^$/.test(after)
        const punctBefore = PUNCTUATION.test(before)
        const punctAfter = PUNCTUATION.test(after)
        return cx.addDelimiter(
          HighlightDelim,
          pos,
          pos + 2,
          !spaceAfter && (!punctAfter || spaceBefore || punctBefore),
          !spaceBefore && (!punctBefore || spaceAfter || punctAfter),
        )
      },
    },
  ],
}
