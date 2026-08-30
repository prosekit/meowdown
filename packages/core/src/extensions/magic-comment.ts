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
  unlinked?: boolean
}

// A whole inline comment carrying a JSON object: `<!-- {...} -->`.
const MAGIC_COMMENT_RE = /^<!--\s*(\{[^}]*\})\s*-->$/
// Same, anchored to the end of a string, for stripping the whole trailing
// run: a rewrite of an image whose comment had not folded could stack a
// second comment behind the first.
const TRAILING_MAGIC_COMMENT_RE = /(?:<!--\s*\{[^}]*\}\s*-->)+$/

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
  const unlinked = data.unlinked === true ? true : undefined

  // Not a magic comment unless it carries at least one recognized field.
  if (!width && !height && !unlinked) return

  return { width, height, unlinked }
}

function toPositiveNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value)
  }
}

/**
 * The canonical comment meowdown writes for the metadata.
 */
export function formatMagicComment(magic: MagicComment): string {
  return `<!-- ${JSON.stringify(magic)} -->`
}

/**
 * Drop the trailing run of magic comments from the source text.
 */
export function stripMagicComment(source: string): string {
  return source.replace(TRAILING_MAGIC_COMMENT_RE, '')
}
