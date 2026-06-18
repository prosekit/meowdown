/**
 * Curated, tunable list of TLDs that meowdown autolinks when they appear in a
 * bare domain (no scheme, no `www.`). It deliberately omits TLDs that double as
 * common code-file extensions even though they are real ccTLDs: `md` (markdown),
 * `sh` (shell), `pl` (perl), `rs` (rust). Those still autolink behind a
 * `www.`/scheme prefix, just not bare, so `README.md` and `deploy.sh` stay
 * plain text.
 */
const BARE_AUTOLINK_TLDS: ReadonlySet<string> = new Set([
  // generic
  'com',
  'org',
  'net',
  'edu',
  'gov',
  'mil',
  'int',
  'info',
  'biz',
  // popular new gTLDs
  'io',
  'co',
  'ai',
  'app',
  'dev',
  'me',
  'xyz',
  'online',
  'site',
  'tech',
  'blog',
  'shop',
  'store',
  'cloud',
  'page',
  'wiki',
  // common ccTLDs used as vanity / real sites
  'us',
  'uk',
  'ca',
  'de',
  'fr',
  'jp',
  'cn',
  'au',
  'in',
  'ru',
  'br',
  'eu',
  'nl',
  'es',
  'it',
  'ch',
  'se',
  'kr',
])

// A single DNS label: alphanumeric, hyphens allowed inside but not at the edges.
const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i

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
    if (label.length > 63 || !LABEL_RE.test(label)) return false
  }
  return true
}
