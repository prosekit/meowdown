import { markdownToDoc } from './md-to-pm.ts'
import { docToMarkdown } from './pm-to-md.ts'

/**
 * How faithfully markdown survives a parse-then-serialize round trip:
 * - `exact`: byte-identical (modulo the trailing newline).
 * - `normalizing`: bytes differ, but only as layout the parser collapses back -
 *   no non-blank line content is lost and re-parsing the output yields the same
 *   doc (e.g. a lazy continuation re-indented to its canonical column).
 * - `lossy`: content changed - a non-blank line differs, or the re-parsed doc does.
 */
export type RoundTripFidelity = 'exact' | 'normalizing' | 'lossy'

function trimTrailingNewlines(text: string): string {
  return text.replace(/\n+$/u, '')
}

// A line carries no content when it is empty, whitespace, or holds only
// blockquote markers (`>`). An empty `>` is the blockquote form of a blank
// line, so the serializer inserting one between blocks is layout, not content.
function isBlankLine(line: string): boolean {
  return /^[\s>]*$/u.test(line)
}

function nonBlankLines(text: string): string[] {
  return text.split('\n').filter((line) => !isBlankLine(line))
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
  const textMatches =
    before.length === after.length && before.every((line, i) => line.trim() === after[i].trim())
  const stable = doc.eq(markdownToDoc(serialized, { frontmatter: options.frontmatter }))

  return textMatches && stable ? 'normalizing' : 'lossy'
}
