const GENERIC_TLDS =
  'com net org xyz info online top biz shop site icu store cyou club vip live рф app buzz tech space fun dev pro mobi life website cloud click work art asia tokyo blog link one world africa bar gov'

const COUNTRY_TLDS =
  'ac ad ae af ag ai al am an ao aq ar as at au aw ax az ba bb bd be bf bg bh bi bj bm bn bo br bs bt bv bw by bz ca cc cd cf cg ch ci ck cl cm cn co cr cu cv cw cx cy cz dj dk dm do dz ec ee eg er es et eu fi fj fk fm fo fr ga gb gd ge gf gg gh gi gl gm gn gp gq gr gs gt gu gw gy hk hm hn hr ht hu id ie il im in io iq ir is it je jm jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx my mz na nc ne nf ng ni nl no np nr nu nz om pa pe pf pg ph pk pl pn pr ps pt pw py qa re ro rs ru rw sa sb sc sd se sg sh si sj sk sl sm sn so sr st su sv sx sy sz tc td tf tg th tj tk tl tm tn to tr tv tw tz ua ug uk us uy uz va vc ve vg vi vn vu wf ws ye yt za zm zw'

/**
 * The TLDs a bare GFM literal autolink is allowed to use. Common generic
 * TLDs plus every two-letter country code, mirroring reflect-editor's
 * curated "popular TLD" list. Explicit `<...>` autolinks and `[](...)`
 * links are not subject to this set.
 */
export const COMMON_TLDS: ReadonlySet<string> = new Set(
  `${GENERIC_TLDS} ${COUNTRY_TLDS}`.split(' '),
)

/**
 * Pull the TLD (last domain label) out of an autolink's visible text.
 * Handles a leading `scheme:`, protocol-relative `//`, userinfo or an
 * email local part (`@`), a port, a path/query/hash, and a trailing dot.
 * Returns the lowercased TLD, or `undefined` when there is no dotted host.
 */
export function extractTld(urlText: string): string | undefined {
  let host = urlText.replace(/^[a-z][a-z0-9+.-]*:/i, '')
  host = host.replace(/^\/\//, '')
  const atIndex = host.lastIndexOf('@')
  if (atIndex >= 0) host = host.slice(atIndex + 1)
  host = host.split(/[/?#:]/)[0]
  host = host.replace(/\.+$/, '')
  const dotIndex = host.lastIndexOf('.')
  if (dotIndex < 0) return undefined
  return host.slice(dotIndex + 1).toLowerCase()
}

/** Whether an autolink's visible text ends in an allowed common TLD. */
export function hasAllowedTld(urlText: string): boolean {
  const tld = extractTld(urlText)
  return tld != null && COMMON_TLDS.has(tld)
}
