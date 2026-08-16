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
  const serialized = docToMarkdown(doc, { frontmatter })
  if (trimTrailingNewlines(serialized) === trimTrailingNewlines(markdown)) return 'exact'

  const markdownContent = removeMarkdownStructure(markdown)
  const serializedContent = removeMarkdownStructure(serialized)
  return markdownContent === serializedContent ? 'normalizing' : 'lossy'
}

function removeMarkdownStructure(markdown: string) {
  return markdown.replaceAll(/[-+=[\]|<>()`~$*\s]+/gu, '')
}
