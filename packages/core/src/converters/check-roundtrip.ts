import type { ProseMirrorNode } from '@prosekit/pm/model'

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

// Collapse internal whitespace runs to a single space and trim the ends. The
// serializer normalizes insignificant spacing without changing content (a double
// space after a heading marker, `#  x` becomes `# x`; a re-indented lazy
// continuation), so two lines that differ only in their whitespace runs carry
// the same content: that is layout, not loss.
function collapseWhitespace(line: string): string {
  return line.trim().replaceAll(/\s+/gu, ' ')
}

// The serializer guards a paragraph line that would re-parse as a block (a
// setext heading underline, an empty ATX heading or list item) by prefixing a
// backslash; the parser keeps the backslash verbatim, so both spellings are the
// same text here.
function unescapeBlockGuard(line: string): string {
  return line.replaceAll(/\\([#>+*|`~=$_0-9-])/gu, (_match, char: string) => char)
}

// A line that starts with a fence marker (`$$`, ```` ``` ````, `~~~`, with or
// without a language) is structural: opening a fence and closing it on the next
// line (or a fence with no content on one line) is layout, not content. The
// language itself is layout too - the re-parsed doc comparison keeps it.
const FENCE_START_RE = /^(?:`{3,}|~{3,}|\${2})/u

// A leading blockquote marker, or several, each optionally followed by spaces.
// The space between `>` and its content is layout (`>x` and `> x` are the same
// blockquote), and so is a marker run split across nesting levels (`> > x` vs
// `>> x`).
function stripBlockquotePrefix(line: string): string {
  return line.replace(/^(?:>[ \t]*)+/u, '')
}

// A leading list marker (`-`, `+`, `*`, or an ordered `1.` / `1)`), when
// followed by whitespace or the end of the line. The gap between the marker and
// the content is layout (`-x` is a paragraph and keeps its `-`; `- x` is a list
// item and sheds the marker). The marker itself is structural, so an empty item
// (`-`) normalizes to nothing.
function stripListMarker(line: string): string {
  const match = /^(?:[-+*]|\d{1,9}[.)])/u.exec(line)
  if (match == null) return line
  const rest = line.slice(match[0].length)
  if (rest !== '' && !/^[ \t]/u.test(rest)) return line
  return rest.replace(/^[ \t]+/u, '')
}

// Blockquote and list markers nest in either order (`> - x`, `- > x`), so strip
// them until stable.
function stripContainers(line: string): string {
  for (;;) {
    const stripped = stripBlockquotePrefix(stripListMarker(line))
    if (stripped === line) break
    line = stripped
  }
  return line
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

// Split a pipe-bearing line into its cells, dropping leading container markers
// and outer pipes. Used by both the row canonicalizer and the delimiter check.
function splitTableCells(line: string): string[] {
  return line
    .replace(/^[\s>]*/u, '')
    .replace(/^\|/u, '')
    .replace(/\|$/u, '')
    .split('|')
    .map(collapseWhitespace)
}

// A pipe-bearing line is read as a table row. The column count is layout (the
// parser sizes a table by its widest row), so trailing empty cells in a data
// row and trailing no-alignment cells in a delimiter row are dropped; the
// re-parsed doc comparison below keeps the real column structure.
function normalizeTableRow(line: string): string {
  const cells = splitTableCells(line)
  while (cells.length > 0 && cells[cells.length - 1] === '') cells.pop()
  if (cells.length > 0 && cells.every((cell) => DELIMITER_CELL_RE.test(cell))) {
    for (let index = 0; index < cells.length; index++) {
      cells[index] = canonicalizeDelimiterCell(cells[index])
    }
    while (cells.length > 1 && cells[cells.length - 1] === '---') cells.pop()
  }
  return collapseWhitespace(`| ${cells.join(' | ')} |`)
}

// Reduce one line to its content; a line that normalizes to nothing (blank,
// structural, or a bare fence marker) is dropped from the comparison. When
// `forceTable` is set, a pipe-less line is read as a table row (GFM lets a
// single-cell row omit its pipes), matching the `contentLines` table context.
function normalizeLine(line: string, forceTable = false): string {
  let rest = unescapeBlockGuard(line)
  rest = collapseWhitespace(rest)
  rest = stripContainers(rest)
  if (FENCE_START_RE.test(rest)) return ''
  if (forceTable || rest.includes('|')) return normalizeTableRow(rest)
  return rest
}

// Whether a container-stripped line would start a block that ends a table
// (a heading, blockquote, list item, fence, or thematic break). A plain-text
// line after a table's delimiter is a data row instead.
const BLOCK_START_RE =
  /^(?:#{1,6}(?:[ \t]|$)|>|(?:[-+*]|\d{1,9}[.)])(?:[ \t]|$)|(?:`{3,}|~{3,}|\${2})(?:[ \t]|$)|(?:-{3,}|\*{3,}|_{3,})[ \t]*$)/u

// Whether a pipe-bearing line would read as a table delimiter row (every cell
// is a dash run, optionally colon-aligned). A delimiter row is what makes the
// following pipe-less lines data rows.
function isDelimiterLine(line: string): boolean {
  const cells = splitTableCells(line).filter((cell) => cell !== '')
  return cells.length > 0 && cells.every((cell) => DELIMITER_CELL_RE.test(cell))
}

/**
 * Reduce the content of `text` to a sequence of canonical lines, dropping blank
 * lines and lines that carry only structural markers. Two texts are
 * content-equal when their sequences match, so the serializer may normalize
 * layout (blockquote and list markers, fence forms, table cell padding) without
 * a line being reported as lost. After a table's delimiter row (a delimiter
 * cell following an earlier pipe line), following non-blank lines are rows
 * until a blank line or a block start; a single-cell row may omit its pipes,
 * so such a line is read as a row.
 */
function contentLines(text: string): string[] {
  const out: string[] = []
  let seenPipe = false
  let afterDelimiter = false
  for (const line of text.split('\n')) {
    if (line.trim() === '') {
      seenPipe = false
      afterDelimiter = false
      continue
    }
    const hasPipe = line.includes('|')
    if (hasPipe) {
      if (seenPipe && isDelimiterLine(line)) afterDelimiter = true
      seenPipe = true
    } else if (afterDelimiter && BLOCK_START_RE.test(collapseWhitespace(line))) {
      afterDelimiter = false
    }
    const normalized = normalizeLine(line, hasPipe || afterDelimiter)
    if (normalized !== '') out.push(normalized)
  }
  return out
}

// Two documents carry the same content when their text matches after
// normalization. The `contentLines` comparison above keeps the block structure;
// here a paragraph that re-parses as a setext heading, or nested empty lists
// that re-read as a thematic break, still counts as normalizing as long as no
// text is lost.
function sameContent(a: ProseMirrorNode, b: ProseMirrorNode): boolean {
  return normalizeText(a.textContent) === normalizeText(b.textContent)
}

// Text compares whitespace-normalized per line: the serializer trims trailing
// whitespace and re-parsing can consume a leading tab as container indent, so
// space/tab runs within a line are layout. Newlines (soft breaks) stay content.
function normalizeText(text: string): string {
  return unescapeBlockGuard(text).split('\n').map(collapseWhitespace).join('\n')
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
  const doc = markdownToDoc(markdown, { frontmatter: options.frontmatter })
  const serialized = docToMarkdown(doc, { frontmatter: options.frontmatter })
  if (trimTrailingNewlines(serialized) === trimTrailingNewlines(markdown)) return 'exact'

  // The output must parse back to the same document, or the round trip changed
  // the structure (a list became a paragraph, a table lost a row, ...).
  const reparsed = markdownToDoc(serialized, { frontmatter: options.frontmatter })
  if (!sameContent(doc, reparsed)) return 'lossy'

  // The first parse must not have dropped any source line's content (a table
  // cell wider than the delimiter row, a sentence truncated mid-line).
  const before = contentLines(markdown)
  const after = contentLines(serialized)
  if (before.length !== after.length) return 'lossy'
  if (!before.every((line, index) => line === after[index])) return 'lossy'

  return 'normalizing'
}
