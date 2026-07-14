/** The parsed source payload of an Obsidian-style `![[target]]` embed. */
export interface ParsedWikiEmbed {
  /** Target before an optional alias or size suffix. */
  target: string
  /** Non-size suffix after `|`, or `''` when absent. */
  display: string
  /** Requested display width in CSS pixels, or `null`. */
  width: number | null
  /** Requested display height in CSS pixels, or `null`. */
  height: number | null
}

/** A resolved wiki embed rendered through Meowdown's existing atom views. */
export type WikiEmbedResolution =
  | {
      kind: 'image'
      /** Source passed to `resolveImageUrl` and image click handlers. Defaults to `target`. */
      src?: string
      /** Image alt text. Defaults to the alias or target basename. */
      alt?: string
    }
  | {
      kind: 'file'
      /** Destination passed to file metadata and click handlers. Defaults to `target`. */
      href?: string
      /** File pill label. Defaults to the alias or target basename. */
      name?: string
      /** Optional file title. */
      title?: string
    }
  | {
      kind: 'note'
      /** Target passed to wikilink click handlers. Defaults to the source target. */
      target?: string
      /** Chip label. Defaults to the source alias or resolved target. */
      display?: string
    }

/**
 * Classifies one wiki embed for rendering. Return `undefined` to leave the
 * source literal and editable. The resolver participates in the parse cache,
 * so it must be pure: the same payload must always return the same result.
 */
export type WikiEmbedResolver = (embed: ParsedWikiEmbed) => WikiEmbedResolution | undefined

/** Host options for wiki-embed parsing. */
export interface WikiEmbedOptions {
  resolveWikiEmbed?: WikiEmbedResolver
}

const WIKI_EMBED_SIZE = /^(\d+)(?:x(\d+))?$/i

function positiveInteger(value: string | undefined): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

/** Parse `![[target]]`, `![[target|alias]]`, `![[target|width]]`, or `![[target|widthxheight]]`. */
export function parseWikiEmbed(source: string): ParsedWikiEmbed {
  const inner = source.replace(/^!\[\[/, '').replace(/\]\]$/, '')
  const pipe = inner.lastIndexOf('|')
  if (pipe < 0) {
    return { target: inner.trim(), display: '', width: null, height: null }
  }

  const target = inner.slice(0, pipe).trim()
  const suffix = inner.slice(pipe + 1).trim()
  const size = WIKI_EMBED_SIZE.exec(suffix)
  if (!size) return { target, display: suffix, width: null, height: null }

  const width = positiveInteger(size[1])
  const height = positiveInteger(size[2])
  if (width == null || (size[2] && height == null)) {
    return { target, display: suffix, width: null, height: null }
  }
  return { target, display: '', width, height }
}

/** Rewrite a wiki image embed with a persisted display size. */
export function formatSizedWikiEmbed(target: string, width: number, height: number): string {
  return `![[${target}|${Math.round(width)}x${Math.round(height)}]]`
}

/** Last path component of a target, with a note heading/block fragment removed. */
export function wikiEmbedBasename(target: string): string {
  const path = target.split(/[?#]/, 1)[0]
  const segment = path.split(/[/\\]/).findLast(Boolean) ?? path
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}
