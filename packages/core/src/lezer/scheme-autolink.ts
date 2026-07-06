import type { MarkdownConfig } from '@lezer/markdown'

import {
  CHAR_LOWERCASE_A,
  CHAR_LOWERCASE_Z,
  CHAR_UPPERCASE_A,
  CHAR_UPPERCASE_Z,
} from '../unicode.ts'

import { BOUNDARY_BEFORE_RE, trimAutolinkEnd } from './bare-autolink.ts'

// `scheme://` plus a non-space tail. The scheme follows RFC 3986 (a letter,
// then letters, digits, `+`, `.`, `-`); requiring the `//` and a non-empty
// tail keeps `note:` prose and a dangling `scheme://` plain text.
const SCHEME_URI_RE = /^[a-z][a-z0-9+.-]*:\/\/[^\s<]+/i

function isSchemeStartChar(code: number): boolean {
  return (
    (code >= CHAR_UPPERCASE_A && code <= CHAR_UPPERCASE_Z) ||
    (code >= CHAR_LOWERCASE_A && code <= CHAR_LOWERCASE_Z)
  )
}

/**
 * Inline parser for a bare custom-scheme URI such as
 * `x-devonthink-item://40C8…` or `obsidian://open?vault=notes`. GFM's own
 * `Autolink` only recognizes `www.`/`http(s)://`/`mailto:`/`xmpp:`/email
 * forms, so an app URI typed or pasted as plain text stayed unlinkified.
 *
 * Registered `after: 'Autolink'` so GFM keeps first claim on the shapes it
 * knows (its `http(s)` domain and end rules stay authoritative); this parser
 * only picks up what GFM declines. It follows `bareAutolink`'s boundary rules
 * and emits the shared `URL` node, so the existing mark walk renders it like
 * any other autolink.
 */
export const schemeAutolink: MarkdownConfig = {
  parseInline: [
    {
      name: 'SchemeAutolink',
      after: 'Autolink',
      parse(cx, next, pos) {
        if (!isSchemeStartChar(next) || cx.hasOpenLink) return -1

        const before = cx.slice(pos - 1, pos)
        if (before !== '' && !BOUNDARY_BEFORE_RE.test(before)) return -1

        const match = SCHEME_URI_RE.exec(cx.slice(pos, cx.end))
        if (!match) return -1

        const length = trimAutolinkEnd(match[0])
        // Trailing-punctuation trimming may leave a tail-less `scheme://`.
        const tailStart = match[0].indexOf('://') + 3
        if (length <= tailStart) return -1

        return cx.addElement(cx.elt('URL', pos, pos + length))
      },
    },
  ],
}
