import type { MarkdownConfig } from '@lezer/markdown'

import {
  CHAR_0,
  CHAR_9,
  CHAR_HASH,
  CHAR_HYPHEN_MINUS,
  CHAR_LOWERCASE_A,
  CHAR_LOWERCASE_Z,
  CHAR_MAX_ASCII,
  CHAR_UNDERSCORE,
  CHAR_UPPERCASE_A,
  CHAR_UPPERCASE_Z,
} from './unicode.ts'

/**
 * Letters, digits, `-`, `_`. Non-ASCII falls back to a Unicode test;
 * surrogate halves fail it, so emoji terminate the tag.
 */
function isTagChar(code: number): boolean {
  return (
    (code >= CHAR_0 && code <= CHAR_9) ||
    (code >= CHAR_UPPERCASE_A && code <= CHAR_UPPERCASE_Z) ||
    (code >= CHAR_LOWERCASE_A && code <= CHAR_LOWERCASE_Z) ||
    code === CHAR_HYPHEN_MINUS ||
    code === CHAR_UNDERSCORE ||
    (code > CHAR_MAX_ASCII && /[\p{L}\p{N}]/u.test(String.fromCharCode(code)))
  )
}

function isLetter(code: number): boolean {
  return (
    (code >= CHAR_UPPERCASE_A && code <= CHAR_UPPERCASE_Z) ||
    (code >= CHAR_LOWERCASE_A && code <= CHAR_LOWERCASE_Z) ||
    (code > CHAR_MAX_ASCII && /\p{L}/u.test(String.fromCharCode(code)))
  )
}

/**
 * Inline parser for `#tag`: `#` followed by tag chars, at least one of
 * them a letter, where the `#` sits at the start of the inline text or
 * after whitespace. Mirrors the tag menu's `(?<!\S)#` trigger in
 * `@meowdown/react`.
 */
export const hashtag: MarkdownConfig = {
  defineNodes: [{ name: 'Hashtag' }],
  parseInline: [
    {
      name: 'Hashtag',
      parse(cx, next, pos) {
        if (next !== CHAR_HASH) return -1
        // An empty slice means start-of-text (upstream parsers use the
        // same idiom).
        if (!/\s|^$/.test(cx.slice(pos - 1, pos))) return -1
        let end = pos + 1
        let hasLetter = false
        while (end < cx.end) {
          const code = cx.char(end)
          if (!isTagChar(code)) break
          hasLetter ||= isLetter(code)
          end++
        }
        if (!hasLetter) return -1
        return cx.addElement(cx.elt('Hashtag', pos, end))
      },
    },
  ],
}
