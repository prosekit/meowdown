import { isObject } from '@ocavue/utils'

/**
 * Metadata meowdown stores in a sidecar `<!-- {...} -->` comment.
 */
export interface MagicComment {
  /**
   * Rendered width in CSS pixels.
   */
  width?: number
  /**
   * Rendered height in CSS pixels.
   */
  height?: number
  /**
   * Whether the URL directly before the comment stays plain text instead of
   * autolinking.
   */
  noLink?: boolean
  /**
   * The saved post-embed snapshot behind an image `src`: the JSON object as
   * written, validated where the card kind is known.
   */
  snapshot?: object
}

// The inline comment carrying a JSON object at the start of the text:
// `<!-- {...} -->`. The object may nest (a snapshot), so the body runs to the
// first closing marker (a body never contains `-->`, see formatMagicComment).
// Not anchored at the end: a rewrite of an image whose comment had not folded
// could stack a second comment behind the first, and the first one wins,
// exactly as the inline-mark walker reads a stacked run.
const MAGIC_COMMENT_RE = /^<!--\s*(\{[\s\S]*?\})\s*-->/
// A whole trailing run of such comments, for stripping them all at once.
const TRAILING_MAGIC_COMMENT_RE = /(?:<!--\s*\{[\s\S]*?\}\s*-->)+$/

/**
 * Read the metadata out of a `<!-- {...} -->` comment, or `undefined` when the
 * text is not a comment carrying at least one recognized field.
 */
export function parseMagicComment(comment: string): MagicComment | undefined {
  const match = MAGIC_COMMENT_RE.exec(comment.trim())
  if (!match) return

  let data: unknown
  try {
    data = JSON.parse(match[1])
  } catch {
    return
  }
  if (!isObject(data)) return

  const width = toPositiveNumber(data.width)
  const height = toPositiveNumber(data.height)
  const noLink = data.noLink === true ? true : undefined
  const snapshot = isObject(data.snapshot) ? data.snapshot : undefined

  // Not a magic comment unless it carries at least one recognized field.
  if (!width && !height && !noLink && !snapshot) return

  return { width, height, noLink, snapshot }
}

function toPositiveNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value)
  }
}

/**
 * The canonical comment meowdown writes for the metadata. `--` inside a JSON
 * string becomes `--`: the inline comment rule of `@lezer/markdown`
 * (CommonMark 0.30) ends a comment at any `--`, so a snapshot text holding a
 * double dash would otherwise cut the comment short. Outside strings JSON
 * only writes `-` as a number sign, never doubled, so the escape keeps the
 * JSON valid and `JSON.parse` restores the text.
 */
export function formatMagicComment(magic: MagicComment): string {
  return `<!-- ${JSON.stringify(magic).replaceAll('--', String.raw`-\u002d`)} -->`
}

/**
 * Drop the trailing run of magic comments from the source text.
 */
export function stripMagicComment(source: string): string {
  return source.replace(TRAILING_MAGIC_COMMENT_RE, '')
}
