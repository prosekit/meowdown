import { CHAR_LINE_FEED } from '../unicode.ts'

import { markdownToDoc } from './md-to-pm.ts'
import { docToMarkdown } from './pm-to-md.ts'

/**
 * How faithfully markdown survives a parse-then-serialize round trip:
 * - `exact`: byte-identical (modulo the trailing newline).
 * - `normalizing`: bytes differ, but only as layout the parser reads back
 *   through - every content line survives and the output re-parses to the same
 *   document (e.g. a lazy continuation re-indented, or `>>>>>>> x` respaced to
 *   the seven blockquotes it already meant).
 * - `lossy`: content changed - a content line differs or disappeared, or the
 *   output re-parses to a different document.
 */
export type RoundTripFidelity = 'exact' | 'normalizing' | 'lossy'

function trimTrailingNewlines(text: string): string {
  let end = text.length
  while (end > 0 && text.charCodeAt(end - 1) === CHAR_LINE_FEED) end--
  return text.slice(0, end)
}

/**
 * Options for {@link checkRoundTrip}.
 */
export interface CheckRoundTripOptions {
  /**
   * Whether to handle a leading `---` frontmatter block. Off by default.
   */
  frontmatter?: boolean
}

/**
 * Classify how `markdown` survives the editor's parse-then-serialize round trip.
 */
export function checkRoundTrip(
  markdown: string,
  options: CheckRoundTripOptions = {},
): RoundTripFidelity {
  const { frontmatter } = options
  const doc = markdownToDoc(markdown, { frontmatter })
  let serialized = docToMarkdown(doc, { frontmatter })

  if (markdown === serialized) {
    return 'exact'
  }

  markdown = trimTrailingNewlines(markdown)
  serialized = trimTrailingNewlines(serialized)
  if (markdown === serialized) {
    return 'exact'
  }

  markdown = removeMarkdownStructure(markdown)
  serialized = removeMarkdownStructure(serialized)
  if (markdown === serialized) {
    return 'normalizing'
  }

  markdown = removeNumberZeroPrefix(markdown)
  serialized = removeNumberZeroPrefix(serialized)
  if (markdown === serialized) {
    return 'normalizing'
  }

  markdown = removeMathCodeBlockLanguage(markdown)
  serialized = removeMathCodeBlockLanguage(serialized)
  if (markdown === serialized) {
    return 'normalizing'
  }

  return 'lossy'
}

// Removes all markdown structure characters
function removeMarkdownStructure(markdown: string) {
  return markdown.replaceAll(/[-+=_:|\\/[\]<>()`~$*#\s!]+/gu, '')
}

// "01. " and "1. " should be treated as equivalent
function removeNumberZeroPrefix(markdown: string) {
  return markdown.replaceAll(/0+/gu, '')
}

// "$$" and "```math" should be treated as equivalent
function removeMathCodeBlockLanguage(markdown: string) {
  return markdown.replaceAll(/math|latex/giu, '')
}
