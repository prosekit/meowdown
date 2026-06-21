import { markdownToDoc } from './md-to-pm.ts'
import { docToMarkdown } from './pm-to-md.ts'

/**
 * How faithfully markdown survives a parse-then-serialize round trip:
 * - `exact`: byte-identical (modulo the trailing newline).
 * - `normalizing`: same non-blank lines ignoring trailing whitespace; only
 *   blank-line layout or insignificant trailing whitespace differs.
 * - `lossy`: a non-blank line changed, so content would be lost or altered.
 */
export type RoundTripFidelity = 'exact' | 'normalizing' | 'lossy'

function trimTrailingNewlines(text: string): string {
  return text.replace(/\n+$/u, '')
}

function nonBlankLines(text: string): string[] {
  return text.split('\n').filter((line) => line.trim() !== '')
}

/** Options for {@link checkRoundTrip}. */
export interface CheckRoundTripOptions {
  /** Whether to handle a leading `---` frontmatter block. Off by default. */
  frontmatter?: boolean
}

/** Classify how `markdown` survives the editor's parse-then-serialize round trip. */
export function checkRoundTrip(
  markdown: string,
  options: CheckRoundTripOptions = {},
): RoundTripFidelity {
  const doc = markdownToDoc(markdown, { frontmatter: options.frontmatter })
  const serialized = docToMarkdown(doc, { frontmatter: options.frontmatter })
  if (trimTrailingNewlines(serialized) === trimTrailingNewlines(markdown)) return 'exact'
  const before = nonBlankLines(markdown)
  const after = nonBlankLines(serialized)
  // Compare by trimEnd: trailing whitespace is insignificant in Markdown and the
  // serializer normalizes it away, so a trailing-space-only difference is
  // `normalizing`, not `lossy`. Leading indentation is structural and must match.
  if (
    before.length === after.length &&
    before.every((line, index) => line.trimEnd() === after[index].trimEnd())
  ) {
    return 'normalizing'
  }
  return 'lossy'
}
