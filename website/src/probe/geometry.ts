import { TextSelection } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

import { describeNode, record } from './recorder.ts'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}

function toRect(rect: DOMRect): Rect {
  return { x: round(rect.left), y: round(rect.top), w: round(rect.width), h: round(rect.height) }
}

function coordsAt(view: EditorView, pos: number, side: -1 | 1): Rect | { error: string } {
  try {
    const coords = view.coordsAtPos(pos, side)
    return {
      x: round(coords.left),
      y: round(coords.top),
      w: round(coords.right - coords.left),
      h: round(coords.bottom - coords.top),
    }
  } catch (error) {
    return { error: String(error) }
  }
}

/**
 * Everything we know how to ask the browser about the caret at `pos`, plus the
 * four candidate predicates for "will the native caret be visible here". The
 * predicates are recorded raw and unjudged: the human verdict from the
 * observation buttons is what scores them later.
 *
 * This forces layout, so it only runs on the geometry page.
 */
export function measureCaret(view: EditorView, label: string): void {
  const pos = view.state.selection.head
  const selection = view.dom.ownerDocument.getSelection()
  const detail: Record<string, unknown> = { label, pos }

  let rangeRects: Rect[] = []
  let containerFontSize: string | undefined
  let containerCaretColor: string | undefined
  let containerLineHeight: string | undefined

  if (selection != null && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0).cloneRange()
    range.collapse(true)
    rangeRects = Array.from(range.getClientRects()).map(toRect)
    detail.domAnchor = describeNode(range.startContainer)
    detail.domOffset = range.startOffset
    detail.rangeRects = rangeRects
    detail.rangeBounding = toRect(range.getBoundingClientRect())

    const container = range.startContainer
    const element = container instanceof Element ? container : container.parentElement
    if (element != null) {
      const style = getComputedStyle(element)
      containerFontSize = style.fontSize
      containerCaretColor = style.caretColor
      containerLineHeight = style.lineHeight
      detail.containerElement = describeNode(element)
      detail.containerFontSize = containerFontSize
      detail.containerLineHeight = containerLineHeight
      detail.containerCaretColor = containerCaretColor
    }
  } else {
    detail.domAnchor = 'no-range'
  }

  const before = coordsAt(view, pos, -1)
  const after = coordsAt(view, pos, 1)
  detail.coordsBefore = before
  detail.coordsAfter = after

  const $head = view.state.doc.resolve(pos)
  detail.pm = {
    parent: $head.parent.type.name,
    parentOffset: $head.parentOffset,
    marks: $head.marks().map((mark) => mark.type.name),
    textBefore: $head.parent.textBetween(Math.max(0, $head.parentOffset - 8), $head.parentOffset),
    textAfter: $head.parent.textBetween(
      $head.parentOffset,
      Math.min($head.parent.content.size, $head.parentOffset + 8),
    ),
  }

  const tallest = rangeRects.reduce((max, rect) => Math.max(max, rect.h), 0)
  const lineHeight = 'h' in before ? before.h : 'h' in after ? after.h : 0
  detail.predictions = {
    noRects: rangeRects.length === 0,
    zeroHeight: rangeRects.length > 0 && tallest === 0,
    fontSizeZero: containerFontSize === '0px',
    shorterThanLine: lineHeight > 0 && tallest < lineHeight * 0.5,
  }

  record('measure', 'caret-geometry', detail)
}

/**
 * Steps the caret through every position of the textblock holding the current
 * selection and measures each one. Runs without any touch input, so it can be
 * driven from a phone with a single tap.
 */
export function walkTextblock(view: EditorView): void {
  const $from = view.state.doc.resolve(view.state.selection.head)
  const start = $from.start()
  const end = $from.end()
  record('note', 'walk-start', { start, end, parent: $from.parent.type.name })
  for (let pos = start; pos <= end; pos++) {
    const target = TextSelection.near(view.state.doc.resolve(pos), 1)
    view.dispatch(view.state.tr.setSelection(target))
    // The hide-mode snap plugin may move the caret off `pos`; the label keeps
    // the requested position so the log shows both.
    measureCaret(view, `walk@${pos}`)
  }
  record('note', 'walk-end', { start, end })
}
