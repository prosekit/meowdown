import type { Line, MarkdownConfig } from '@lezer/markdown'

import {
  CHAR_0,
  CHAR_9,
  CHAR_BACKWARD_SLASH,
  CHAR_DOLLAR,
  CHAR_LINE_FEED,
  isSpaceChar,
} from './unicode.ts'

function isDigit(code: number): boolean {
  return code >= CHAR_0 && code <= CHAR_9
}

/** A line whose content is exactly `$$`, allowing trailing whitespace. */
function isBlockMathFence(line: Line): boolean {
  if (line.next !== CHAR_DOLLAR) return false
  if (line.text.charCodeAt(line.pos + 1) !== CHAR_DOLLAR) return false
  if (line.text.charCodeAt(line.pos + 2) === CHAR_DOLLAR) return false
  return line.skipSpace(line.pos + 2) === line.text.length
}

/**
 * How many composite contexts (blockquote, list item) the line still sits
 * inside. `Line.depth` is not in the public typings (the FencedCode parser
 * reads it the same way); if a future upgrade drops it, every line counts as
 * still inside, and an unterminated block simply runs longer.
 */
function getLineDepth(line: Line): number {
  // @ts-expect-error `Line.depth` is not in the public typings
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const depth: number = line.depth
  return typeof depth === 'number' ? depth : Number.MAX_SAFE_INTEGER
}

/**
 * Inline parser for `$x$` and `$$x$$` TeX math, following Pandoc-style
 * delimiter rules: the opening and closing runs must have the same length (1
 * or 2 dollars), the content must not start or end with a space, the closing
 * run must not be followed by a digit (so `$20,000 and $30,000` stays plain
 * text), and the whole expression stays on one line. A backslash-escaped `\$`
 * inside the content does not close. Runs are greedy: an opener preceded by
 * another dollar never starts a new expression, and the first closing
 * candidate decides: if it is invalid the whole expression fails, so an
 * unpaired dollar never scans across the rest of the line. Claims the
 * element eagerly, so the content is atomic: no nested markdown.
 */
export const math: MarkdownConfig = {
  defineNodes: [
    { name: 'InlineMath' },
    { name: 'InlineMathMark' },
    { name: 'BlockMath', block: true },
    { name: 'BlockMathMark' },
  ],
  parseBlock: [
    {
      name: 'BlockMath',
      before: 'FencedCode',
      // Mirrors the FencedCode block parser: the fences become
      // `BlockMathMark`s and the TeX lines become `CodeText` elements
      // (excluding container prefixes such as a blockquote's `> `), so the
      // converter reads the content the same way it reads a code fence.
      // Container markers (`Line.markers` is internal API) are not re-emitted;
      // nothing in meowdown reads them inside a math block. An unterminated
      // block runs to the end of its container.
      parse(cx, line) {
        if (!isBlockMathFence(line)) return false
        const from = cx.lineStart + line.pos
        const marks = [cx.elt('BlockMathMark', from, from + 2)]
        for (let first = true, empty = true, hasLine = false; ; first = false) {
          if (!cx.nextLine() || getLineDepth(line) < cx.depth) break
          if (isBlockMathFence(line)) {
            if (empty && hasLine) {
              marks.push(cx.elt('CodeText', cx.lineStart - 1, cx.lineStart))
            }
            marks.push(
              cx.elt('BlockMathMark', cx.lineStart + line.pos, cx.lineStart + line.pos + 2),
            )
            cx.nextLine()
            break
          }
          hasLine = true
          if (!first) {
            marks.push(cx.elt('CodeText', cx.lineStart - 1, cx.lineStart))
            empty = false
          }
          const textFrom = cx.lineStart + line.basePos
          const textTo = cx.lineStart + line.text.length
          if (textFrom < textTo) {
            marks.push(cx.elt('CodeText', textFrom, textTo))
            empty = false
          }
        }
        cx.addElement(cx.elt('BlockMath', from, cx.prevLineEnd(), marks))
        return true
      },
      endLeaf(_cx, line) {
        return isBlockMathFence(line)
      },
    },
  ],
  parseInline: [
    {
      name: 'InlineMath',
      after: 'InlineCode',
      parse(cx, next, pos) {
        if (next !== CHAR_DOLLAR || cx.char(pos - 1) === CHAR_DOLLAR) return -1
        const delimLength = cx.char(pos + 1) === CHAR_DOLLAR ? 2 : 1
        if (cx.char(pos + delimLength) === CHAR_DOLLAR) return -1
        const contentFrom = pos + delimLength
        if (isSpaceChar(cx.char(contentFrom))) return -1
        for (let i = contentFrom; i < cx.end; i++) {
          const code = cx.char(i)
          if (code === CHAR_LINE_FEED) return -1
          if (code === CHAR_BACKWARD_SLASH) {
            i++
            continue
          }
          if (code !== CHAR_DOLLAR) continue
          let closeLength = 1
          while (cx.char(i + closeLength) === CHAR_DOLLAR) closeLength++
          if (
            closeLength !== delimLength ||
            isSpaceChar(cx.char(i - 1)) ||
            isDigit(cx.char(i + closeLength))
          ) {
            return -1
          }
          const end = i + closeLength
          return cx.addElement(
            cx.elt('InlineMath', pos, end, [
              cx.elt('InlineMathMark', pos, contentFrom),
              cx.elt('InlineMathMark', i, end),
            ]),
          )
        }
        return -1
      },
    },
  ],
}
