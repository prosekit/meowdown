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

// A line's opening markers - indentation, blockquote `>`, list bullets and
// numbers - say which block the line belongs to, not what it says. Which line
// carries them is the serializer's choice: a `>` swallows one optional space, a
// lazy continuation is written back under its container's marker, and an item
// whose marker and content start on separate source lines is joined onto one.
// Every detail that distinguishes one marker from another (bullet character,
// start number, gap width) is a node attribute, so the document comparison
// covers them; here the markers only get in the way of comparing content.
const CONTAINER_PREFIX_RE = /^(?:[\s>]|[-+*](?=\s|$)|\d{1,9}[.)](?=\s|$))+/u

// Whitespace inside a line is layout as well: markdown ignores the spacing
// around a heading marker (`#  x`), a fence's info string (``` ``` js ```), a
// table's pipes, and a line's own ends. What the line says is its non-blank
// characters, so drop the whitespace rather than trying to place it.
function stripWhitespace(line: string): string {
  return line.replaceAll(/\s/gu, '')
}

// A fence opens with a run of at least three backticks or tildes.
const FENCE_RUN_RE = /^(?:`{3,}|~{3,})/u

// Shorten a fence's run to the three characters it takes to open one: a closing
// fence may be written longer than the fence it closes, and the serializer
// writes it back at the opening fence's length, so the width is layout. This
// runs before the whitespace goes, so `~~~ ~` keeps its `~` info string instead
// of reading as a four-tilde run.
function shortenFenceRun(line: string): string {
  const run = FENCE_RUN_RE.exec(line)?.[0]
  return run === undefined ? line : run.slice(0, 3) + line.slice(run.length)
}

// A GFM delimiter cell is optional colons around a run of dashes.
const DELIMITER_CELL_RE = /^:?-+:?$/u

// Reduce a pipe-bearing line to the cell text it carries. Outer pipes are table
// layout, an empty cell says nothing, and a delimiter row is pure structure: it
// encodes the column count and the alignment, both of which are node attributes
// the document comparison covers. A line the serializer never restructures (a
// paragraph or code line holding pipes) reduces the same way on both sides, so
// equal lines stay equal.
function canonicalizeTableRow(line: string): string | undefined {
  if (!line.includes('|')) return undefined
  const cells = line.replace(/^\|/u, '').replace(/\|$/u, '').split('|')
  if (cells.every((cell) => DELIMITER_CELL_RE.test(cell))) return ''
  return cells.filter((cell) => cell !== '').join('|')
}

/**
 * The lines of `text` that carry content, each reduced to that content. A line
 * left empty by dropping its markers and whitespace (a blank line, a bare `>`,
 * a list marker whose content is on the next line) carries none and is skipped.
 */
function contentLines(text: string): string[] {
  const lines: string[] = []
  for (const line of text.split('\n')) {
    const content = stripWhitespace(shortenFenceRun(line.replace(CONTAINER_PREFIX_RE, '')))
    if (content !== '') lines.push(canonicalizeTableRow(content) ?? content)
  }
  return lines
}

/**
 * Whether `wanted` appears in `found` as an ordered subsequence.
 *
 * The serializer may write a line the source never had: an unterminated fenced
 * block gets the closing fence it was missing. Such a line carries no content,
 * which the document comparison proves - so only a content line that fails to
 * come back out is loss.
 */
function containsInOrder(found: ReadonlyArray<string>, wanted: ReadonlyArray<string>): boolean {
  let index = 0
  for (const line of found) {
    if (index === wanted.length) return true
    if (line === wanted[index]) index++
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
  const doc = markdownToDoc(markdown, { frontmatter })
  const serialized = docToMarkdown(doc, { frontmatter })
  if (trimTrailingNewlines(serialized) === trimTrailingNewlines(markdown)) return 'exact'

  // Content first: it is the cheaper of the two checks, and skipping it saves
  // the second parse whenever the text alone already shows the loss.
  if (!containsInOrder(contentLines(serialized), contentLines(markdown))) return 'lossy'
  return markdownToDoc(serialized, { frontmatter }).eq(doc) ? 'normalizing' : 'lossy'
}
