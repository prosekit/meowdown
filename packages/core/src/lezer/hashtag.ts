import type { MarkdownConfig } from '@lezer/markdown'

const HASH = 35

/**
 * Letters, digits, `-`, `_`. Non-ASCII falls back to a Unicode test;
 * surrogate halves fail it, so emoji terminate the tag.
 */
function isTagChar(code: number): boolean {
  return (
    (code >= 48 && code <= 57) || // 0-9
    (code >= 65 && code <= 90) || // A-Z
    (code >= 97 && code <= 122) || // a-z
    code === 45 || // -
    code === 95 || // _
    (code > 127 && /[\p{L}\p{N}]/u.test(String.fromCharCode(code)))
  )
}

function isLetter(code: number): boolean {
  return (
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    (code > 127 && /\p{L}/u.test(String.fromCharCode(code)))
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
        if (next !== HASH) return -1
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
