import type { TreeCursor } from '@lezer/common'
import { gfmBlockOnlyParser, isSpaceChar, LEZER_NODE_IDS } from '@meowdown/markdown'
import type { ProseMirrorNode } from '@prosekit/pm/model'

import type { CodeBlockFenceStyle } from '../extensions/code-block.ts'
import type { ListMarker, MeowdownListAttrs, TaskMarker } from '../extensions/list.ts'
import { getNodeBuilders, type TypedNodeBuilders } from '../extensions/schema.ts'
import type { TableColumnAlign } from '../extensions/table-column-align.ts'
import {
  CHAR_ASTERISK,
  CHAR_DOT,
  CHAR_EQUAL,
  CHAR_HASH,
  CHAR_HYPHEN_MINUS,
  CHAR_LINE_FEED,
  CHAR_LOWERCASE_X,
  CHAR_PLUS,
  CHAR_RIGHT_PARENTHESIS,
  CHAR_SPACE,
  CHAR_TAB,
  CHAR_TILDE,
  CHAR_UPPERCASE_X,
} from '../unicode.ts'

/** Options for {@link markdownToDoc}. */
export interface MarkdownToDocOptions {
  /** Node builders to build the document with. Defaults to the shared schema's builders. */
  nodes?: TypedNodeBuilders

  /** Whether to peel a leading `---` frontmatter block onto the doc's `frontmatter` attribute. Off by default. */
  frontmatter?: boolean
}

/**
 * Convert a markdown string into a ProseMirror document node.
 *
 * By default the document is built with the shared schema's node builders, so
 * no editor is required. When the result will be loaded into a specific editor,
 * pass that editor's `nodes` so the document uses the editor's own schema
 * instance and can be inserted without a JSON round trip.
 *
 * The output follows the extension set defined in `../extensions/extension.ts`
 * (doc, paragraph, text, heading, blockquote, list, codeBlock, table, tableRow,
 * tableCell, tableHeaderCell, horizontalRule). The function does not produce
 * inline marks because the markdown stays literal text - emphasis / link /
 * inline-code characters survive verbatim.
 */
export function markdownToDoc(
  markdown: string,
  options: MarkdownToDocOptions = {},
): ProseMirrorNode {
  const { nodes = getNodeBuilders(), frontmatter = false } = options

  // Optionally peel a leading `---` frontmatter block off before lezer.
  let frontmatterBody: string | undefined
  let rest = markdown
  if (frontmatter) {
    const [body, matchLength] = matchFrontmatter(markdown)
    frontmatterBody = body
    if (matchLength) rest = markdown.slice(matchLength)
  }

  const tree = gfmBlockOnlyParser.parse(rest)
  const cursor = tree.cursor()
  const blocks = collectBlocks(nodes, cursor, rest)

  return nodes.doc(frontmatterBody === undefined ? {} : { frontmatter: frontmatterBody }, blocks)
}

/**
 * Matches a leading YAML frontmatter block: a `---` fence at offset 0, a body,
 * and a closing `---` fence, each fence being exactly three dashes followed by
 * optional spaces or tabs. Returns the body (the lines between the fences,
 * joined by `\n`, without a trailing newline) and the length of the matched
 * region, or undefined when there is no terminated frontmatter block (a lone `---`
 * with no closing fence stays a thematic break).
 */
const FRONTMATTER_RE = /^---[ \t]*\r?\n([\s\S]*?\n)?---[ \t]*(?:\r?\n|$)/

function matchFrontmatter(
  markdown: string,
): [body?: string | undefined, matchLength?: number | undefined] {
  const match = FRONTMATTER_RE.exec(markdown)
  if (!match) return []
  const body = (match[1] ?? '').replace(/\r?\n$/, '')
  return [body, match[0].length]
}

/**
 * Walk the current node's children, converting each block-level child
 * and flattening any node converter that returns multiple siblings
 * (lists are the main case).
 */
function collectBlocks(
  nodes: TypedNodeBuilders,
  cursor: TreeCursor,
  text: string,
): ProseMirrorNode[] {
  const out: ProseMirrorNode[] = []
  if (!cursor.firstChild()) return out
  let previousTo: number | undefined
  do {
    if (previousTo != null) appendGapParagraphs(out, nodes, text, previousTo, cursor.from)
    previousTo = cursor.to
    out.push(...convertBlock(nodes, cursor, text))
  } while (cursor.nextSibling())
  cursor.parent()
  return out
}

/**
 * Blank lines between two sibling blocks are content: a run of K blank lines
 * is one block separator plus K-1 empty paragraphs. The gap slice between the
 * siblings' ranges holds only line terminators and structural prefixes
 * (indent, blockquote `>`), so counting newlines is enough - the gap has K+1
 * of them (the previous block's own terminator plus one per blank line).
 */
function appendGapParagraphs(
  out: ProseMirrorNode[],
  nodes: TypedNodeBuilders,
  text: string,
  gapFrom: number,
  gapTo: number,
): void {
  let newlineCount = 0
  for (let i = gapFrom; i < gapTo; i++) {
    if (text.charCodeAt(i) === CHAR_LINE_FEED) newlineCount++
  }
  for (let i = 2; i < newlineCount; i++) out.push(nodes.paragraph())
}

function convertBlock(
  nodes: TypedNodeBuilders,
  cursor: TreeCursor,
  text: string,
): ProseMirrorNode[] {
  switch (cursor.type.id) {
    case LEZER_NODE_IDS.ATXHeading1:
      return [convertHeading(nodes, cursor, text, 1, false)]
    case LEZER_NODE_IDS.ATXHeading2:
      return [convertHeading(nodes, cursor, text, 2, false)]
    case LEZER_NODE_IDS.ATXHeading3:
      return [convertHeading(nodes, cursor, text, 3, false)]
    case LEZER_NODE_IDS.ATXHeading4:
      return [convertHeading(nodes, cursor, text, 4, false)]
    case LEZER_NODE_IDS.ATXHeading5:
      return [convertHeading(nodes, cursor, text, 5, false)]
    case LEZER_NODE_IDS.ATXHeading6:
      return [convertHeading(nodes, cursor, text, 6, false)]
    case LEZER_NODE_IDS.SetextHeading1:
      return [convertHeading(nodes, cursor, text, 1, true)]
    case LEZER_NODE_IDS.SetextHeading2:
      return [convertHeading(nodes, cursor, text, 2, true)]
    case LEZER_NODE_IDS.Paragraph:
      return [convertParagraph(nodes, cursor, text)]
    case LEZER_NODE_IDS.CommentBlock:
      // A comment is not rendered output: map it onto the invisible `htmlComment`
      // node so it stays in the document (and round-trips) without reading as
      // body text. Raw HTML / processing-instruction blocks fall through to a
      // paragraph - they can carry content a reader expects to see.
      return [convertHTMLComment(nodes, cursor, text)]
    case LEZER_NODE_IDS.HTMLBlock:
    case LEZER_NODE_IDS.ProcessingInstructionBlock:
      // The schema has no HTML node, so keep the raw block as literal paragraph
      // text; it survives verbatim through a round-trip.
      return [convertParagraph(nodes, cursor, text)]
    case LEZER_NODE_IDS.Blockquote:
      return [convertBlockquote(nodes, cursor, text)]
    case LEZER_NODE_IDS.BulletList:
      return convertList(nodes, cursor, text, 'bullet')
    case LEZER_NODE_IDS.OrderedList:
      return convertList(nodes, cursor, text, 'ordered')
    case LEZER_NODE_IDS.FencedCode:
    case LEZER_NODE_IDS.CodeBlock:
      return [convertCodeBlock(nodes, cursor, text)]
    case LEZER_NODE_IDS.BlockMath:
      return [convertBlockMath(nodes, cursor, text)]
    case LEZER_NODE_IDS.HorizontalRule: {
      // Keep the source marker (`***`, `___`, `- - -`, ...); `---` is canonical
      // and stays null. Trailing spaces are insignificant, so drop them.
      const marker = text.slice(cursor.from, cursor.to).trimEnd()
      return [nodes.horizontalRule({ marker: marker === '---' ? null : marker })]
    }
    case LEZER_NODE_IDS.Table:
      return [convertTable(nodes, cursor, text)]
    case LEZER_NODE_IDS.Task:
      // Reached only for tasks inside ordered lists (bullet lists convert
      // the Task in `convertListItem`). The flat-list schema has a single
      // `kind`, so an ordered item cannot also be a task - keep the
      // `[x]` marker as literal paragraph text so it round-trips verbatim.
      return [convertParagraph(nodes, cursor, text)]
    default: {
      // Never silently drop a block: an unhandled type keeps its raw source as literal paragraph text. Warn so a
      // missing converter case surfaces instead of losing content quietly.
      const raw = text.slice(cursor.from, cursor.to)
      if (raw.trim() === '') return []
      console.warn(`[meowdown] unsupported lezer block "${cursor.type.name}"`)
      return [convertParagraph(nodes, cursor, text)]
    }
  }
}

function convertHeading(
  nodes: TypedNodeBuilders,
  cursor: TreeCursor,
  text: string,
  level: number,
  isSetext: boolean,
): ProseMirrorNode {
  // Strip the opening HeaderMark (just the "#" run; the space after it is not
  // part of the mark) and capture any optional closing HeaderMark of "# foo #"
  // style. A setext heading's only HeaderMark is the trailing underline, so
  // guard on the mark starting at the heading's left edge before treating it as
  // the opening mark.
  const headingFrom = cursor.from
  let contentStart = cursor.from
  let contentEnd = cursor.to
  let trailingMarkFrom = -1
  let trailingMarkTo = -1
  if (cursor.firstChild()) {
    if (cursor.type.id === LEZER_NODE_IDS.HeaderMark && cursor.from === headingFrom) {
      contentStart = cursor.to
    }
    let lastId = -1
    let lastFrom = -1
    let lastTo = -1
    do {
      lastId = cursor.type.id
      lastFrom = cursor.from
      lastTo = cursor.to
    } while (cursor.nextSibling())
    if (lastId === LEZER_NODE_IDS.HeaderMark && lastFrom > contentStart) {
      contentEnd = lastFrom
      trailingMarkFrom = lastFrom
      trailingMarkTo = lastTo
    }
    cursor.parent()
  }

  // Dedent before trimming so a multi-line setext heading inside a container
  // (rare) keeps its continuation lines aligned; trim then drops the outer ends.
  const raw = text.slice(contentStart, contentEnd)
  const content = dedentContinuation(raw, measureContentColumn(text, contentStart)).trim()
  // A trailing HeaderMark is the setext underline of a setext heading, or the
  // closing `#` run of an ATX heading (`# foo #`). CommonMark allows either run
  // any length, so keep the source count to make the round-trip lossless.
  const setextUnderline = isSetext
    ? countUnderlineChars(text, trailingMarkFrom, trailingMarkTo) || 1
    : null
  const closingHashes =
    !isSetext && trailingMarkFrom >= 0
      ? countHashChars(text, trailingMarkFrom, trailingMarkTo) || null
      : null
  return nodes.heading({ level, setextUnderline, closingHashes }, content)
}

/** Count the `=` / `-` characters in a setext underline run. */
function countUnderlineChars(text: string, from: number, to: number): number {
  if (from < 0) return 0
  let count = 0
  for (let i = from; i < to; i++) {
    const code = text.charCodeAt(i)
    if (code === CHAR_EQUAL || code === CHAR_HYPHEN_MINUS) count++
  }
  return count
}

/** Count the `#` characters between `from` and `to`. */
function countHashChars(text: string, from: number, to: number): number {
  if (from < 0) return 0
  let count = 0
  for (let i = from; i < to; i++) {
    if (text.charCodeAt(i) === CHAR_HASH) count++
  }
  return count
}

/**
 * The column at which content begins on the line containing `from` (i.e. the
 * enclosing container's content column). Columns count a tab as a CommonMark
 * tab stop of 4 (`4 - col % 4`), matching how lezer measures indentation.
 */
export function measureContentColumn(text: string, from: number): number {
  const lineStart = text.lastIndexOf('\n', from - 1) + 1
  let col = 0
  for (let index = lineStart; index < from; index++) {
    col += text.charCodeAt(index) === CHAR_TAB ? 4 - (col % 4) : 1
  }
  return col
}

/** Drop a line's leading whitespace up to `column`, counting a tab as `4 - col % 4` columns. */
export function sliceColumn(line: string, column: number): string {
  let col = 0
  let index = 0
  while (index < line.length && col < column) {
    const code = line.charCodeAt(index)
    if (code === CHAR_SPACE) col += 1
    else if (code === CHAR_TAB) col += 4 - (col % 4)
    else break
    index++
  }
  return line.slice(index)
}

/**
 * Strip a leaf block's structural continuation indent.
 *
 * lezer keeps the indent of a multi-line block's continuation lines inside the
 * source span (its `scrub` pads each line's container prefix to equal-width
 * whitespace to preserve positions). CommonMark and lezer require every
 * continuation line to be indented to the same content `column`, which equals
 * the block's first-line column. The first line is already past its indent, so
 * only lines 2..n are dedented. Returns `content` untouched at column 0 (a
 * top-level block) or when there is no continuation line.
 */
export function dedentContinuation(content: string, column: number): string {
  if (column === 0 || !content.includes('\n')) return content
  return content
    .split('\n')
    .map((line, index) => (index === 0 ? line : sliceColumn(line, column)))
    .join('\n')
}

/**
 * Build a paragraph from raw markdown content, dedenting continuation lines so
 * the serializer's own line prefix does not double the indent. A soft line break
 * stays a literal `\n` in a single text node; the paragraph spec's
 * `whitespace: 'pre'` keeps a DOM re-read from folding it to a space.
 */
function buildParagraph(
  nodes: TypedNodeBuilders,
  content: string,
  column: number,
): ProseMirrorNode {
  // An empty string adds no child (the builder skips falsy text), so this also
  // covers the empty-paragraph case.
  return nodes.paragraph(dedentContinuation(content, column))
}

function convertParagraph(
  nodes: TypedNodeBuilders,
  cursor: TreeCursor,
  text: string,
): ProseMirrorNode {
  const from = cursor.from
  const to = cursor.to
  const column = measureContentColumn(text, from)
  // In block-only parsing a paragraph has no inline children, with one
  // exception: lezer leaves the lazy-continuation `QuoteMark`s of a multi-line
  // blockquote (`> l1\n> l2`) embedded in the paragraph's span.
  if (cursor.firstChild()) {
    let content = ''
    let pos = from
    do {
      if (cursor.type.id === LEZER_NODE_IDS.QuoteMark) {
        content += text.slice(pos, cursor.from)
        pos = cursor.to
        if (isSpaceChar(text.charCodeAt(pos))) pos += 1
      }
    } while (cursor.nextSibling())
    cursor.parent()
    content += text.slice(pos, to)
    return buildParagraph(nodes, content, column)
  }
  return buildParagraph(nodes, text.slice(from, to), column)
}

/**
 * Build the invisible `htmlComment` node from a `CommentBlock`. The raw comment
 * (delimiters included) is kept verbatim on the node's `content` attribute;
 * continuation lines are dedented like a paragraph's so the serializer's own
 * line prefix re-applies the container indent instead of doubling it.
 */
function convertHTMLComment(
  nodes: TypedNodeBuilders,
  cursor: TreeCursor,
  text: string,
): ProseMirrorNode {
  const column = measureContentColumn(text, cursor.from)
  const content = dedentContinuation(text.slice(cursor.from, cursor.to), column)
  return nodes.htmlComment({ content })
}

function convertBlockquote(
  nodes: TypedNodeBuilders,
  cursor: TreeCursor,
  text: string,
): ProseMirrorNode {
  const content: ProseMirrorNode[] = []
  if (cursor.firstChild()) {
    let previousTo: number | undefined
    do {
      if (cursor.type.id === LEZER_NODE_IDS.QuoteMark) continue
      if (previousTo != null) appendGapParagraphs(content, nodes, text, previousTo, cursor.from)
      previousTo = cursor.to
      content.push(...convertBlock(nodes, cursor, text))
    } while (cursor.nextSibling())
    cursor.parent()
  }
  return nodes.blockquote(content)
}

function convertList(
  nodes: TypedNodeBuilders,
  cursor: TreeCursor,
  text: string,
  kind: 'bullet' | 'ordered',
): ProseMirrorNode[] {
  const items: ProseMirrorNode[] = []
  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === LEZER_NODE_IDS.ListItem) {
        items.push(convertListItem(nodes, cursor, text, kind))
      }
    } while (cursor.nextSibling())
    cursor.parent()
  }
  return items
}

function convertListItem(
  nodes: TypedNodeBuilders,
  cursor: TreeCursor,
  text: string,
  kind: 'bullet' | 'ordered',
): ProseMirrorNode {
  const content: ProseMirrorNode[] = []
  let taskChecked: boolean | undefined
  let taskMarker: TaskMarker | undefined
  let order: number | undefined
  let marker: ListMarker | undefined
  let markEndColumn: number | undefined
  let firstContentColumn: number | undefined
  if (cursor.firstChild()) {
    do {
      if (cursor.type.id !== LEZER_NODE_IDS.ListMark && firstContentColumn == null) {
        firstContentColumn = measureContentColumn(text, cursor.from)
      }
      if (cursor.type.id === LEZER_NODE_IDS.ListMark) {
        if (kind === 'ordered') {
          // An ordered list marker is a sequence of 1–9 arabic digits `(0-9)`, followed by either a `.` character or a `)` character.
          // https://spec.commonmark.org/0.31.2/#ordered-list-marker
          const delimiterCode = text.charCodeAt(cursor.to - 1)
          if (delimiterCode === CHAR_RIGHT_PARENTHESIS) {
            marker = ')'
          } else if (delimiterCode === CHAR_DOT) {
            marker = '.'
          }
          const number = Number.parseInt(text.slice(cursor.from, cursor.to), 10)
          order = Number.isFinite(number) ? number : 1
        } else {
          // A bullet list marker is one of `-`, `+`, or `*`.
          // https://spec.commonmark.org/0.31.2/#bullet-list-marker
          const code = text.charCodeAt(cursor.from)
          marker = code === CHAR_ASTERISK ? '*' : code === CHAR_PLUS ? '+' : '-'
        }
        markEndColumn = measureContentColumn(text, cursor.to)
        continue
      }
      if (kind === 'bullet' && cursor.type.id === LEZER_NODE_IDS.Task) {
        // A GFM `Task` leaf (`[ ] text` / `[x] text`, after the list mark).
        let taskStart = cursor.from
        const taskEnd = cursor.to
        taskChecked = false
        if (cursor.firstChild()) {
          if (cursor.type.id === LEZER_NODE_IDS.TaskMarker) {
            const taskMarkerCode = text.charCodeAt(cursor.from + 1)
            if (taskMarkerCode === CHAR_LOWERCASE_X) {
              taskChecked = true
              taskMarker = 'x'
            } else if (taskMarkerCode === CHAR_UPPERCASE_X) {
              taskChecked = true
              taskMarker = 'X'
            }
            taskStart = cursor.to
          }
          cursor.parent()
        }
        // Skip the single separating whitespace after `[ ]` / `[x]`
        if (isSpaceChar(text.charCodeAt(taskStart))) taskStart += 1
        const taskText = text.slice(taskStart, taskEnd)
        content.push(buildParagraph(nodes, taskText, measureContentColumn(text, taskStart)))
        continue
      }
      content.push(...convertBlock(nodes, cursor, text))
    } while (cursor.nextSibling())
    cursor.parent()
  }
  // The gap between the marker and the content. A gap of 5+ is indented code (a
  // different node, so `firstContentColumn` would be the code block's), and 1 is the
  // canonical default; only a 2-4 space gap is a faithful, content-preserving variation.
  const gap =
    firstContentColumn != null && markEndColumn != null ? firstContentColumn - markEndColumn : 1
  // A bullet whose marker is `+` is a collapsed item (`-`/`*` are expanded). The
  // marker is normalized to null so an expanded item later serializes as `-`. A
  // `+ [ ]` is still a circle task, so collapse only applies when there is no
  // checkbox.
  const isTask = taskChecked != null
  const collapsed = !isTask && kind === 'bullet' && marker === '+'
  return nodes.list(
    {
      kind: isTask ? 'task' : kind,
      order: kind === 'ordered' ? (order ?? 1) : null,
      checked: taskChecked ?? false,
      collapsed,
      marker: collapsed ? null : marker,
      taskMarker,
      markerGap: gap >= 2 && gap <= 4 ? gap : 1,
    } satisfies MeowdownListAttrs,
    content,
  )
}

function convertCodeBlock(
  nodes: TypedNodeBuilders,
  cursor: TreeCursor,
  text: string,
): ProseMirrorNode {
  const indented = cursor.type.id === LEZER_NODE_IDS.CodeBlock
  let language = ''
  let code = ''
  let fenceStyle: CodeBlockFenceStyle | null = indented ? 'indented' : null
  let fenceLength: number | null = null
  let sawOpeningMark = false
  if (cursor.firstChild()) {
    do {
      switch (cursor.type.id) {
        case LEZER_NODE_IDS.CodeMark: {
          // Only the opening fence sets the style and length; a longer
          // closing fence is normalized back to the opening length.
          if (sawOpeningMark) break
          sawOpeningMark = true
          if (text.charCodeAt(cursor.from) === CHAR_TILDE) fenceStyle = 'tilde'
          const markLength = cursor.to - cursor.from
          if (markLength > 3) fenceLength = markLength
          break
        }
        case LEZER_NODE_IDS.CodeInfo:
          language = text.slice(cursor.from, cursor.to)
          break
        case LEZER_NODE_IDS.CodeText:
          code += text.slice(cursor.from, cursor.to)
          break
      }
    } while (cursor.nextSibling())
    cursor.parent()
  }
  return nodes.codeBlock({ language, fenceStyle, fenceLength }, code)
}

/**
 * A `$$` display math block is a code block whose `language` is `math`; the
 * `dollar` fence style makes it serialize back to `$$` fences.
 */
function convertBlockMath(
  nodes: TypedNodeBuilders,
  cursor: TreeCursor,
  text: string,
): ProseMirrorNode {
  let code = ''
  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === LEZER_NODE_IDS.CodeText) {
        code += text.slice(cursor.from, cursor.to)
      }
    } while (cursor.nextSibling())
    cursor.parent()
  }
  return nodes.codeBlock({ language: 'math', fenceStyle: 'dollar', fenceLength: null }, code)
}

function convertTable(nodes: TypedNodeBuilders, cursor: TreeCursor, text: string): ProseMirrorNode {
  // The delimiter row (a `TableDelimiter` that is a direct child of `Table`)
  // is the only source that always encodes every column, so it drives the
  // column count and the column alignment. `@lezer/markdown` emits no
  // `TableCell` for an empty cell, so counting per-row cells would drop empty
  // columns and misalign the rest.
  let aligns: Array<TableColumnAlign | null> = []
  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === LEZER_NODE_IDS.TableDelimiter) {
        aligns = parseDelimiterAligns(text.slice(cursor.from, cursor.to))
      }
    } while (cursor.nextSibling())
    cursor.parent()
  }

  const rows: ProseMirrorNode[] = []
  if (cursor.firstChild()) {
    do {
      const id = cursor.type.id
      if (id === LEZER_NODE_IDS.TableHeader) {
        rows.push(convertTableRow(nodes, cursor, text, true, aligns))
      } else if (id === LEZER_NODE_IDS.TableRow) {
        rows.push(convertTableRow(nodes, cursor, text, false, aligns))
      }
    } while (cursor.nextSibling())
    cursor.parent()
  }
  return nodes.table(rows)
}

function parseDelimiterAligns(separator: string): Array<TableColumnAlign | null> {
  return separator
    .split('|')
    .map((segment) => segment.trim())
    .filter((segment) => segment !== '')
    .map((segment) => {
      const left = segment.startsWith(':')
      const right = segment.endsWith(':')
      if (left && right) return 'center'
      if (left) return 'left'
      if (right) return 'right'
      return null
    })
}

function convertTableRow(
  nodes: TypedNodeBuilders,
  cursor: TreeCursor,
  text: string,
  isHeader: boolean,
  aligns: ReadonlyArray<TableColumnAlign | null>,
): ProseMirrorNode {
  const columnCount = aligns.length
  const cellTexts: string[] = Array<string>(columnCount).fill('')
  if (cursor.firstChild()) {
    const hasLeadingPipe = cursor.type.id === LEZER_NODE_IDS.TableDelimiter
    let delimiterCount = 0
    do {
      if (cursor.type.id === LEZER_NODE_IDS.TableDelimiter) {
        delimiterCount++
      } else if (cursor.type.id === LEZER_NODE_IDS.TableCell) {
        const column = delimiterCount - (hasLeadingPipe ? 1 : 0)
        if (column >= 0 && column < columnCount) {
          // Unescape `\|` to a logical `|`; the serializer re-escapes it.
          cellTexts[column] = text
            .slice(cursor.from, cursor.to)
            .trim()
            .replaceAll(String.raw`\|`, '|')
        }
      }
    } while (cursor.nextSibling())
    cursor.parent()
  }

  const cells = cellTexts.map((cellText, column) => {
    const paragraph = nodes.paragraph(cellText)
    const attrs = { align: aligns[column] }
    return isHeader ? nodes.tableHeaderCell(attrs, paragraph) : nodes.tableCell(attrs, paragraph)
  })
  return nodes.tableRow(cells)
}
