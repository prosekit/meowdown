/**
 * Allowed TLDs when they appear in a bare domain (no scheme, no `www.`).
 *
 * The 10 most-visited TLDs by real Chrome traffic.
 * Source: Chrome UX Report https://github.com/zakird/crux-top-lists
 */
const BARE_AUTOLINK_TLDS: ReadonlySet<string> = new Set([
  'com',
  'br',
  'net',
  'jp',
  'org',
  'in',
  'de',
  'ru',
  'it',
  'fr',
])

// A single DNS label: alphanumeric, hyphens allowed inside but not at the edges.
const DNS_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i

/** The host portion of a bare candidate: everything before the first `/`. */
export function hostFromUrl(text: string): string {
  const slash = text.indexOf('/')
  return slash === -1 ? text : text.slice(0, slash)
}

/**
 * True when `host` (no scheme, no `@`, path already stripped) is a bare domain
 * meowdown links. Rules:
 *
 * - at least two dot-separated labels (host + tld)
 * - the last label is in `BARE_AUTOLINK_TLDS` (matched case-insensitively)
 * - the registrable label (the one before the tld) is at least 3 chars, so
 *   `t.co` / `x.io` / `do.so` stay plain text
 * - every label is a valid DNS label (alphanumeric, inner hyphens only, <= 63
 *   chars), which also rejects IP-like input such as `1.2.3.4` because its last
 *   label is not a known tld
 */
export function isLinkableBareHost(host: string): boolean {
  const labels = host.split('.')
  if (labels.length < 2) return false

  const tld = labels[labels.length - 1].toLowerCase()
  if (!BARE_AUTOLINK_TLDS.has(tld)) return false

  const registrable = labels[labels.length - 2]
  if (registrable.length < 3) return false

  for (const label of labels) {
    if (label.length > 63 || !DNS_LABEL_RE.test(label)) return false
  }
  return true
}

/**
 * Derive the `href` for an autolink from its visible text:
 *
 * - a URL with a scheme is used as-is
 * - an email becomes `mailto:`
 * - a `www.` URL gets an implied `https://`
 * - a bare domain on the curated TLD list gets an implied `https://`
 * - anything else returns `undefined`
 */
export function getAutolinkHref(urlText: string): string | undefined {
  if (/^[a-z][a-z0-9+.-]*:/i.test(urlText)) return urlText
  if (/^[^\s@]+@[^\s@]+$/.test(urlText)) return `mailto:${urlText}`
  if (/^www\./i.test(urlText)) return `https://${urlText}`
  if (isLinkableBareHost(hostFromUrl(urlText))) return `https://${urlText}`
  return undefined
}
