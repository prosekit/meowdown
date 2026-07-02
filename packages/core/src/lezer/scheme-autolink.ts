import type { MarkdownConfig } from '@lezer/markdown'

import { BOUNDARY_BEFORE_RE, trimAutolinkEnd } from './bare-autolink.ts'

// RFC 3986: scheme = ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )
const SCHEME_NAME_RE = /^[a-z][a-z0-9+.-]*$/i

/**
 * Inline parser for host-configured scheme autolinks such as
 * `reflect://today`. GFM's autolink only knows `www.` / `http(s)://` /
 * email / `mailto:` / `xmpp:` forms, so a custom app scheme stays plain
 * text unless the host opts in with `autolinkSchemes`. Matches
 * `<scheme>://<rest>` for each configured scheme (case-insensitive, rest
 * is any non-whitespace run) with the same before-boundary and
 * trailing-punctuation rules as `bareAutolink`, and emits the shared
 * `URL` node so the existing mark walk renders it like any other
 * autolink.
 */
export function schemeAutolink(schemes: readonly string[]): MarkdownConfig {
  for (const scheme of schemes) {
    if (!SCHEME_NAME_RE.test(scheme)) {
      throw new RangeError(
        `Invalid autolink scheme ${JSON.stringify(scheme)}: expected a letter followed by letters, digits, "+", "-" or "." (write "reflect", not "reflect://")`,
      )
    }
  }

  // Match over-eagerly up to whitespace/`<`; trimAutolinkEnd drops
  // trailing punctuation afterwards. `+` and `.` are the only regex
  // metacharacters the scheme grammar allows.
  const urlRe = new RegExp(
    String.raw`^(?:${schemes.map((scheme) => scheme.replaceAll(/[+.]/g, String.raw`\$&`)).join('|')})://[^\s<]+`,
    'i',
  )

  // Char codes that can start a configured scheme, for a cheap first-char
  // rejection before slicing and running the regex.
  const startCodes = new Set<number>()
  for (const scheme of schemes) {
    startCodes.add(scheme.toLowerCase().charCodeAt(0))
    startCodes.add(scheme.toUpperCase().charCodeAt(0))
  }

  return {
    parseInline: [
      {
        name: 'SchemeAutolink',
        before: 'Link',
        parse(cx, next, pos) {
          if (!startCodes.has(next) || cx.hasOpenLink) return -1

          const before = cx.slice(pos - 1, pos)
          if (before !== '' && !BOUNDARY_BEFORE_RE.test(before)) return -1

          const match = urlRe.exec(cx.slice(pos, cx.end))
          if (!match) return -1

          const length = trimAutolinkEnd(match[0])
          const text = match[0].slice(0, length)
          // Trimming never removes a `/`, so the only degenerate leftover
          // is a scheme with an empty rest (`reflect://.` trimmed back to
          // `reflect://`), which should stay plain text.
          if (text.endsWith('://')) return -1

          return cx.addElement(cx.elt('URL', pos, pos + length))
        },
      },
    ],
  }
}
