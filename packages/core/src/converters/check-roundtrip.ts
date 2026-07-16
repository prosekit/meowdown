import { markdownToDoc } from './md-to-pm.ts'
import { docToMarkdown } from './pm-to-md.ts'

/**
 * How faithfully markdown survives a parse-then-serialize round trip:
 * - `exact`: byte-identical (modulo the trailing newline).
 * - `normalizing`: bytes differ, but only as layout the parser collapses back -
 *   no non-blank line content is lost and re-parsing the output yields the same
 *   doc (e.g. a lazy continuation re-indented to its canonical column, or a
 *   table delimiter row rewritten to canonical dashes).
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
// equal; the leading `[\s>]*` prefix is kept so rows inside a blockquote
// compare within their blockquote.
function canonicalizeTableRow(line: string): string | undefined {
  if (!line.includes('|')) return undefined
  const prefix = /^[\s>]*/u.exec(line)?.[0] ?? ''
  const row = line.slice(prefix.length).trim()
  const inner = row.replace(/^\|/u, '').replace(/\|$/u, '')
  const cells = inner.split('|').map((cell) => collapseWhitespace(cell))
  const rendered = cells.every((cell) => DELIMITER_CELL_RE.test(cell))
    ? cells.map(canonicalizeDelimiterCell)
    : cells
  return collapseWhitespace(`${prefix} | ${rendered.join(' | ')} |`)
}

function normalizeLine(line: string): string {
  return canonicalizeTableRow(line) ?? collapseWhitespace(line)
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
    before.length === after.length &&
    before.every((line, i) => normalizeLine(line) === normalizeLine(after[i]))

  return textMatches ? 'normalizing' : 'lossy'
}
