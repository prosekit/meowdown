import { isObject } from '@ocavue/utils'

/** Metadata meowdown stores in a sidecar `<!-- {...} -->` comment. */
export interface MagicComment {
  /** Rendered width in CSS pixels. */
  width?: number
  /** Rendered height in CSS pixels. */
  height?: number
}

// A whole inline comment carrying a JSON object: `<!-- {...} -->`.
const MAGIC_COMMENT_RE = /^<!--\s*(\{[^}]*\})\s*-->$/
// Same, anchored to the end of a string, for stripping a trailing comment.
const TRAILING_MAGIC_COMMENT_RE = /<!--\s*\{[^}]*\}\s*-->$/

/**
 * Read the metadata out of a `<!-- {...} -->` comment, or `undefined` when the
 * text is not a comment carrying at least one recognized field.
 */
export function parseMagicComment(comment: string): MagicComment | undefined {
  const match = MAGIC_COMMENT_RE.exec(comment.trim())
  if (!match) return undefined
  let data: unknown
  try {
    data = JSON.parse(match[1])
  } catch {
    return
  }
  if (!isObject(data)) {
    return
  }
  const magic = readMagicComment(data)
  // Not a magic comment unless it carries at least one recognized field.
  return Object.keys(magic).length > 0 ? magic : undefined
}

// Pick + validate the known fields. The single place new metadata fields are added.
function readMagicComment(data: Record<string, unknown>): MagicComment {
  const magic: MagicComment = {}
  const { width, height } = data
  if (typeof width === 'number' && Number.isFinite(width) && width > 0) {
    magic.width = Math.round(width)
  }
  if (typeof height === 'number' && Number.isFinite(height) && height > 0) {
    magic.height = Math.round(height)
  }
  return magic
}

/** The canonical comment meowdown writes for the metadata. */
export function formatMagicComment(magic: MagicComment): string {
  return `<!-- ${JSON.stringify(magic)} -->`
}

/** Drop a trailing magic comment from the source text. */
export function stripMagicComment(source: string): string {
  return source.replace(TRAILING_MAGIC_COMMENT_RE, '')
}
