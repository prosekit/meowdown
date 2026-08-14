import { markdownToDoc } from './md-to-pm.ts'
import { docToMarkdown } from './pm-to-md.ts'

/**
 * How faithfully markdown survives a parse-then-serialize round trip:
 * - `exact`: byte-identical (modulo the trailing newline).
 * - `normalizing`: bytes differ, but only as layout the parser collapses back -
 *   re-parsing the output yields the same doc and every content line survives
 *   (e.g. a lazy continuation re-indented to its canonical column, or a table
 *   delimiter row rewritten to canonical dashes).
 * - `lossy`: content changed - a content line differs or disappeared, or the
 *   re-parsed doc does.
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

// Collapse internal whitespace runs to a single space and trim the ends. The
// serializer normalizes insignificant spacing without changing content (a double
// space after a heading marker, `#  x` becomes `# x`; a re-indented lazy
// continuation), so two lines that differ only in their whitespace runs carry
// the same content: that is layout, not loss.
function collapseWhitespace(line: string): string {
  return line.trim().replaceAll(/\s+/gu, ' ')
}

// A GFM delimiter cell is optional colons around a run of dashes. The dash
// count is layout; only the colon positions carry content (column alignment).
const DELIMITER_CELL_RE = /^:?-+:?$/u

function canonicalizeDelimiterCell(cell: string): string {
  const alignsLeft = cell.startsWith(':')
  const alignsRight = cell.endsWith(':')
  if (alignsLeft && alignsRight) return ':-:'
  if (alignsLeft) return ':--'
  if (alignsRight) return '--:'
  return '---'
}

// Rebuild a pipe-bearing line into the serializer's `| a | b |` form. Outer
// pipes, spacing around pipes, and delimiter dash counts are table layout the
// parser reads through, so two rows that differ only there carry the same
// content. Lines the serializer never restructures (a paragraph or code line
// holding pipes) canonicalize the same way on both sides, so equal lines stay
// equal.
function canonicalizeTableRow(line: string): string | undefined {
  if (!line.includes('|')) return undefined
  const row = line.trim()
  const inner = row.replace(/^\|/u, '').replace(/\|$/u, '')
  const cells = inner.split('|').map((cell) => collapseWhitespace(cell))
  const rendered = cells.every((cell) => DELIMITER_CELL_RE.test(cell))
    ? cells.map(canonicalizeDelimiterCell)
    : cells
  return `| ${rendered.join(' | ')} |`
}

// A line's leading indent and blockquote markers say which block the line
// belongs to, not what it says. Which line carries them is the serializer's
// choice: a lazy continuation is written back under its container's marker
// (`>a\n*` serializes as `> a\n> *`), and the marker swallows one optional
// space either way. Block structure is compared as a document below, so strip
// the prefix here and compare the content behind it.
const CONTAINER_PREFIX_RE = /^\s*(?:>[ \t]?)*/u

function stripContainerPrefix(line: string): string {
  return line.slice(CONTAINER_PREFIX_RE.exec(line)?.[0].length ?? 0)
}

function normalizeLine(line: string): string {
  const content = stripContainerPrefix(line)
  return canonicalizeTableRow(content) ?? collapseWhitespace(content)
}

/**
 * Whether `wanted` appears in `found` as an ordered subsequence.
 *
 * The serializer may write a line the source never had: an unterminated fenced
 * block gets the closing fence it was missing. Such a line changes no content,
 * which the document comparison proves - so only a content line that fails to
 * come back out is loss.
 */
function containsInOrder(found: ReadonlyArray<string>, wanted: ReadonlyArray<string>): boolean {
  let index = 0
  for (const line of found) {
    if (index < wanted.length && line === wanted[index]) index++
  }
  return index === wanted.length
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
  // The serializer ends its output with one newline and no trailing whitespace,
  // so a source ending in whitespace carries a tail no round trip can bring
  // back. Drop it before parsing, or the document comparison below would read
  // that known trim as a changed document.
  const doc = markdownToDoc(markdown.replace(/\s+$/u, ''), { frontmatter })
  const serialized = docToMarkdown(doc, { frontmatter })
  if (trimTrailingNewlines(serialized) === trimTrailingNewlines(markdown)) return 'exact'

  // Structure: the output must re-parse to the document it was written from.
  if (!markdownToDoc(serialized, { frontmatter }).eq(doc)) return 'lossy'

  // Content: every line the source wrote must still be in the output.
  const before = nonBlankLines(markdown).map(normalizeLine)
  const after = nonBlankLines(serialized).map(normalizeLine)
  return containsInOrder(after, before) ? 'normalizing' : 'lossy'
}
