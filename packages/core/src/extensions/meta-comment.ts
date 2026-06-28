/** Metadata meowdown stores in an image's sidecar `<!-- {...} -->` comment. */
export interface MetaComment {
  /** Rendered width in CSS pixels. */
  width?: number
}

// A whole inline comment carrying a JSON object: `<!-- {...} -->`.
const META_COMMENT_RE = /^<!--\s*(\{[^}]*\})\s*-->$/
// Same, anchored to the end of a string, for stripping a trailing comment.
const TRAILING_META_COMMENT_RE = /<!--\s*\{[^}]*\}\s*-->$/

/**
 * Read an image's metadata out of a `<!-- {...} -->` comment, or `undefined` when
 * the text is not a comment carrying at least one recognized field.
 */
export function parseMetaComment(comment: string): MetaComment | undefined {
  const match = META_COMMENT_RE.exec(comment.trim())
  if (!match) return undefined
  let data: unknown
  try {
    data = JSON.parse(match[1])
  } catch {
    return undefined
  }
  if (data == null || typeof data !== 'object') return undefined
  const meta = readMetaComment(data as Record<string, unknown>)
  // Not a meta comment unless it carries at least one recognized field.
  return Object.keys(meta).length > 0 ? meta : undefined
}

// Pick + validate the known fields. The single place new metadata fields are added.
function readMetaComment(data: Record<string, unknown>): MetaComment {
  const meta: MetaComment = {}
  const { width } = data
  if (typeof width === 'number' && Number.isFinite(width) && width > 0) {
    meta.width = Math.round(width)
  }
  return meta
}

/** The canonical comment meowdown writes for an image's metadata. */
export function formatMetaComment(meta: MetaComment): string {
  return `<!-- ${JSON.stringify(meta)} -->`
}

/** Drop a trailing metadata comment from an image source, leaving `![alt](url)`. */
export function stripMetaComment(source: string): string {
  return source.replace(TRAILING_META_COMMENT_RE, '')
}
