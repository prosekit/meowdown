import type { TreeCursor } from '@lezer/common'
import type { ProseMirrorNode } from '@prosekit/pm/model'

import type { TypedEditor } from '../extensions/extension.ts'
import { LEZER_NODE_IDS } from '../lezer/node-ids.ts'
import { gfmBlockOnlyParser } from '../lezer/parser.ts'

/**
 * Convert a markdown string into a ProseMirror document node, built against
 * the schema of the given editor.
 *
 * The output follows the extension set defined in `./prosekit.ts` (doc,
 * paragraph, text, heading, blockquote, list, codeBlock, table, tableRow,
 * tableCell, tableHeaderCell, horizontalRule). The function does not produce
 * inline marks because `prosekit.ts` doesn't register any - emphasis / link /
 * inline-code characters survive as literal text.
 */
export function markdownToDoc(editor: TypedEditor, markdown: string): ProseMirrorNode {
  const tree = gfmBlockOnlyParser.parse(markdown)
  const cursor = tree.cursor()
  const blocks = collectBlocks(editor, cursor, markdown)
  return editor.nodes.doc(blocks)
}

/**
 * Walk the current node's children, converting each block-level child
 * and flattening any node converter that returns multiple siblings
 * (lists are the main case).
 */
function collectBlocks(editor: TypedEditor, cursor: TreeCursor, text: string): ProseMirrorNode[] {
  const out: ProseMirrorNode[] = []
  if (!cursor.firstChild()) return out
  do {
    out.push(...convertBlock(editor, cursor, text))
  } while (cursor.nextSibling())
  cursor.parent()
  return out
}

function convertBlock(editor: TypedEditor, cursor: TreeCursor, text: string): ProseMirrorNode[] {
  switch (cursor.type.id) {
    case LEZER_NODE_IDS.ATXHeading1:
      return [convertHeading(editor, cursor, text, 1)]
    case LEZER_NODE_IDS.ATXHeading2:
      return [convertHeading(editor, cursor, text, 2)]
    case LEZER_NODE_IDS.ATXHeading3:
      return [convertHeading(editor, cursor, text, 3)]
    case LEZER_NODE_IDS.ATXHeading4:
      return [convertHeading(editor, cursor, text, 4)]
    case LEZER_NODE_IDS.ATXHeading5:
      return [convertHeading(editor, cursor, text, 5)]
    case LEZER_NODE_IDS.ATXHeading6:
      return [convertHeading(editor, cursor, text, 6)]
    case LEZER_NODE_IDS.SetextHeading1:
      return [convertHeading(editor, cursor, text, 1)]
    case LEZER_NODE_IDS.SetextHeading2:
      return [convertHeading(editor, cursor, text, 2)]
    case LEZER_NODE_IDS.Paragraph:
      return [convertParagraph(editor, cursor, text)]
    case LEZER_NODE_IDS.Blockquote:
      return [convertBlockquote(editor, cursor, text)]
    case LEZER_NODE_IDS.BulletList:
      return convertList(editor, cursor, text, 'bullet', 1)
    case LEZER_NODE_IDS.OrderedList:
      return convertOrderedList(editor, cursor, text)
    case LEZER_NODE_IDS.FencedCode:
    case LEZER_NODE_IDS.CodeBlock:
      return [convertCodeBlock(editor, cursor, text)]
    case LEZER_NODE_IDS.HorizontalRule:
      return [editor.nodes.horizontalRule()]
    case LEZER_NODE_IDS.Table:
      return [convertTable(editor, cursor, text)]
    default:
      return []
  }
}

function convertHeading(
  editor: TypedEditor,
  cursor: TreeCursor,
  text: string,
  level: number,
): ProseMirrorNode {
  // Strip the opening HeaderMark (the "#" run + following space) and any
  // optional closing HeaderMark used in "# foo #" style.
  let contentStart = cursor.from
  let contentEnd = cursor.to
  if (cursor.firstChild()) {
    if (cursor.type.id === LEZER_NODE_IDS.HeaderMark) {
      contentStart = cursor.to
    }
    let lastId = -1
    let lastFrom = -1
    do {
      lastId = cursor.type.id
      lastFrom = cursor.from
    } while (cursor.nextSibling())
    if (lastId === LEZER_NODE_IDS.HeaderMark && lastFrom > contentStart) {
      contentEnd = lastFrom
    }
    cursor.parent()
  }

  const content = text.slice(contentStart, contentEnd).trim()
  return editor.nodes.heading({ level }, content)
}

function convertParagraph(editor: TypedEditor, cursor: TreeCursor, text: string): ProseMirrorNode {
  const content = text.slice(cursor.from, cursor.to)
  return editor.nodes.paragraph(content)
}

function convertBlockquote(editor: TypedEditor, cursor: TreeCursor, text: string): ProseMirrorNode {
  const content: ProseMirrorNode[] = []
  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === LEZER_NODE_IDS.QuoteMark) continue
      content.push(...convertBlock(editor, cursor, text))
    } while (cursor.nextSibling())
    cursor.parent()
  }
  return editor.nodes.blockquote(content)
}

function convertList(
  editor: TypedEditor,
  cursor: TreeCursor,
  text: string,
  kind: 'bullet' | 'ordered',
  order: number,
): ProseMirrorNode[] {
  const items: ProseMirrorNode[] = []
  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === LEZER_NODE_IDS.ListItem) {
        items.push(convertListItem(editor, cursor, text, kind, order))
      }
    } while (cursor.nextSibling())
    cursor.parent()
  }
  return items
}

function convertOrderedList(
  editor: TypedEditor,
  cursor: TreeCursor,
  text: string,
): ProseMirrorNode[] {
  // Read the start number from the first ListItem's first ListMark text,
  // e.g. "1." → 1, "5." → 5. All items in a single OrderedList share
  // the same `order` attribute on the prosekit side.
  let order = 1
  if (cursor.firstChild()) {
    if (cursor.type.id === LEZER_NODE_IDS.ListItem && cursor.firstChild()) {
      if (cursor.type.id === LEZER_NODE_IDS.ListMark) {
        const markText = text.slice(cursor.from, cursor.to)
        const parsed = Number.parseInt(markText, 10)
        if (Number.isFinite(parsed)) order = parsed
      }
      cursor.parent()
    }
    cursor.parent()
  }
  return convertList(editor, cursor, text, 'ordered', order)
}

function convertListItem(
  editor: TypedEditor,
  cursor: TreeCursor,
  text: string,
  kind: 'bullet' | 'ordered',
  order: number,
): ProseMirrorNode {
  const content: ProseMirrorNode[] = []
  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === LEZER_NODE_IDS.ListMark) continue
      content.push(...convertBlock(editor, cursor, text))
    } while (cursor.nextSibling())
    cursor.parent()
  }
  return editor.nodes.list(
    {
      kind,
      order: kind === 'ordered' ? order : null,
      checked: false,
      collapsed: false,
    },
    content,
  )
}

function convertCodeBlock(editor: TypedEditor, cursor: TreeCursor, text: string): ProseMirrorNode {
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
  return editor.nodes.codeBlock({ language }, code)
}

function convertTable(editor: TypedEditor, cursor: TreeCursor, text: string): ProseMirrorNode {
  const rows: ProseMirrorNode[] = []
  if (cursor.firstChild()) {
    do {
      const id = cursor.type.id
      if (id === LEZER_NODE_IDS.TableHeader) {
        rows.push(convertTableRow(editor, cursor, text, true))
      } else if (id === LEZER_NODE_IDS.TableRow) {
        rows.push(convertTableRow(editor, cursor, text, false))
      }
      // TableDelimiter between header and body is intentionally skipped.
    } while (cursor.nextSibling())
    cursor.parent()
  }
  return editor.nodes.table(rows)
}

function convertTableRow(
  editor: TypedEditor,
  cursor: TreeCursor,
  text: string,
  isHeader: boolean,
): ProseMirrorNode {
  const cells: ProseMirrorNode[] = []
  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === LEZER_NODE_IDS.TableCell) {
        const cellText = text.slice(cursor.from, cursor.to).trim()
        const paragraph = editor.nodes.paragraph(cellText)
        cells.push(
          isHeader ? editor.nodes.tableHeaderCell(paragraph) : editor.nodes.tableCell(paragraph),
        )
      }
    } while (cursor.nextSibling())
    cursor.parent()
  }
  return editor.nodes.tableRow(cells)
}
