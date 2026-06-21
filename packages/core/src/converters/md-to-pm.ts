import type { TreeCursor } from '@lezer/common'
import type { ProseMirrorNode } from '@prosekit/pm/model'

import type { ListMarker, MeowdownListAttrs, TaskMarker } from '../extensions/list.ts'
import { getNodeBuilders, type TypedNodeBuilders } from '../extensions/schema.ts'
import { LEZER_NODE_IDS } from '../lezer/node-ids.ts'
import { gfmBlockOnlyParser } from '../lezer/parser.ts'
import {
  CHAR_ASTERISK,
  CHAR_DOT,
  CHAR_EQUAL,
  CHAR_HYPHEN_MINUS,
  CHAR_LOWERCASE_X,
  CHAR_PLUS,
  CHAR_RIGHT_PARENTHESIS,
  CHAR_UPPERCASE_X,
  isSpaceChar,
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
  do {
    out.push(...convertBlock(nodes, cursor, text))
  } while (cursor.nextSibling())
  cursor.parent()
  return out
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
    case LEZER_NODE_IDS.HTMLBlock:
    case LEZER_NODE_IDS.CommentBlock:
    case LEZER_NODE_IDS.ProcessingInstructionBlock:
      // The schema has no HTML / comment node, so keep the raw block as
      // literal paragraph text; it survives verbatim through a round-trip.
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
  // Strip the opening HeaderMark (the "#" run + following space) and any
  // optional closing HeaderMark used in "# foo #" style. A setext heading's
  // only HeaderMark is the trailing underline, so guard on the mark starting
  // at the heading's left edge before treating it as the opening mark.
  const headingFrom = cursor.from
  let contentStart = cursor.from
  let contentEnd = cursor.to
  let underlineFrom = -1
  let underlineTo = -1
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
      underlineFrom = lastFrom
      underlineTo = lastTo
    }
    cursor.parent()
  }

  const content = text.slice(contentStart, contentEnd).trim()
  // CommonMark setext underlines may be any length; keep the source count so
  // the round-trip is lossless. Fall back to 1 if lezer reported no run.
  const setextUnderline = isSetext
    ? countUnderlineChars(text, underlineFrom, underlineTo) || 1
    : null
  return nodes.heading({ level, setextUnderline }, content)
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

function convertParagraph(
  nodes: TypedNodeBuilders,
  cursor: TreeCursor,
  text: string,
): ProseMirrorNode {
  const from = cursor.from
  const to = cursor.to
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
    return content === '' ? nodes.paragraph() : nodes.paragraph(content)
  }
  return nodes.paragraph(text.slice(from, to))
}

function convertBlockquote(
  nodes: TypedNodeBuilders,
  cursor: TreeCursor,
  text: string,
): ProseMirrorNode {
  const content: ProseMirrorNode[] = []
  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === LEZER_NODE_IDS.QuoteMark) continue
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
  if (cursor.firstChild()) {
    do {
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
        content.push(taskText === '' ? nodes.paragraph() : nodes.paragraph(taskText))
        continue
      }
      content.push(...convertBlock(nodes, cursor, text))
    } while (cursor.nextSibling())
    cursor.parent()
  }
  return nodes.list(
    {
      kind: taskChecked == null ? kind : 'task',
      order: kind === 'ordered' ? (order ?? 1) : null,
      checked: taskChecked ?? false,
      collapsed: false,
      marker,
      taskMarker,
    } satisfies MeowdownListAttrs,
    content,
  )
}

function convertCodeBlock(
  nodes: TypedNodeBuilders,
  cursor: TreeCursor,
  text: string,
): ProseMirrorNode {
  let language = ''
  let code = ''
  if (cursor.firstChild()) {
    do {
      switch (cursor.type.id) {
        case LEZER_NODE_IDS.CodeInfo:
          language = text.slice(cursor.from, cursor.to)
          break
        case LEZER_NODE_IDS.CodeText:
          code = text.slice(cursor.from, cursor.to)
          break
      }
    } while (cursor.nextSibling())
    cursor.parent()
  }
  return nodes.codeBlock({ language }, code)
}

function convertTable(nodes: TypedNodeBuilders, cursor: TreeCursor, text: string): ProseMirrorNode {
  // The delimiter row (a `TableDelimiter` that is a direct child of `Table`)
  // is the only source that always encodes every column, so it drives the
  // column count. `@lezer/markdown` emits no `TableCell` for an empty cell, so
  // counting per-row cells would drop empty columns and misalign the rest.
  let columnCount = 0
  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === LEZER_NODE_IDS.TableDelimiter) {
        columnCount = countDelimiterColumns(text.slice(cursor.from, cursor.to))
      }
    } while (cursor.nextSibling())
    cursor.parent()
  }

  const rows: ProseMirrorNode[] = []
  if (cursor.firstChild()) {
    do {
      const id = cursor.type.id
      if (id === LEZER_NODE_IDS.TableHeader) {
        rows.push(convertTableRow(nodes, cursor, text, true, columnCount))
      } else if (id === LEZER_NODE_IDS.TableRow) {
        rows.push(convertTableRow(nodes, cursor, text, false, columnCount))
      }
    } while (cursor.nextSibling())
    cursor.parent()
  }
  return nodes.table(rows)
}

function countDelimiterColumns(separator: string): number {
  return separator.split('|').filter((segment) => segment.trim() !== '').length
}

function convertTableRow(
  nodes: TypedNodeBuilders,
  cursor: TreeCursor,
  text: string,
  isHeader: boolean,
  columnCount: number,
): ProseMirrorNode {
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

  const cells = cellTexts.map((cellText) => {
    const paragraph = nodes.paragraph(cellText)
    return isHeader ? nodes.tableHeaderCell(paragraph) : nodes.tableCell(paragraph)
  })
  return nodes.tableRow(cells)
}
