/**
 * Allowed TLDs when they appear in a bare domain (no scheme, no `www.`).
 *
 * Source: Top 25 TLDs by domain count https://research.domaintools.com/statistics/tld-counts/
 *
 */
const BARE_AUTOLINK_TLDS: ReadonlySet<string> = new Set([
  'com',
  'de',
  'net',
  'cn',
  'org',
  'uk',
  'xyz',
  'top',
  'nl',
  'ru',
  'info',
  'br',
  'fr',
  'au',
  'shop',
  'eu',
  'ca',
  'in',
  'online',
  'it',
  'co',
  'ch',
  'pl',
  'cc',
  'es',
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
