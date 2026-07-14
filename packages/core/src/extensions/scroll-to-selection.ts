import { definePlugin, isTextSelection, type PlainExtension } from '@prosekit/core'
import { Plugin, PluginKey } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

import { tryCoordsAtPos } from '../utils/caret-coords.ts'

import { measureCaretScrollRect } from './caret-rect.ts'

const key = new PluginKey('meowdown-scroll-to-selection')

interface Rect {
  left: number
  right: number
  top: number
  bottom: number
}

type Sides = number | { top: number; right: number; bottom: number; left: number }

// prosemirror-view scrolls to coordsAtPos(head, 1), but every position beside
// an atom mark view measures as a dimensionless point (the outer span is
// display: contents, the source text font-size: 0): since prosemirror-view
// 1.42.1 the default path silently skips such rects, before that it scrolled
// toward the origin. Take over exactly there, with the same geometry the
// virtual caret draws.
function handleScrollToSelection(view: EditorView): boolean {
  const selection = view.state.selection
  if (!isTextSelection(selection)) return false
  if (tryCoordsAtPos(view, selection.head, 1) != null) return false
  const caret = measureCaretScrollRect(view)
  if (caret == null) return false
  const startDOM = view.domAtPos(selection.head).node
  scrollRectIntoView(
    view,
    { left: caret.left, right: caret.left, top: caret.top, bottom: caret.top + caret.height },
    startDOM,
  )
  return true
}

function getSide(value: Sides, side: 'top' | 'right' | 'bottom' | 'left'): number {
  return typeof value === 'number' ? value : value[side]
}

function parentNode(node: Node): Node | null {
  const parent = (node as HTMLSlotElement).assignedSlot ?? node.parentNode
  return parent?.nodeType === 11 ? (parent as ShadowRoot).host : parent
}

function windowRect(doc: Document): Rect {
  const viewport = doc.defaultView?.visualViewport
  if (viewport) return { left: 0, right: viewport.width, top: 0, bottom: viewport.height }
  return {
    left: 0,
    right: doc.documentElement.clientWidth,
    top: 0,
    bottom: doc.documentElement.clientHeight,
  }
}

function clientRect(node: HTMLElement): Rect {
  const rect = node.getBoundingClientRect()
  // Adjust for elements with style "transform: scale()"
  const scaleX = rect.width / node.offsetWidth || 1
  const scaleY = rect.height / node.offsetHeight || 1
  // Make sure scrollbar width isn't included in the rectangle
  return {
    left: rect.left,
    right: rect.left + node.clientWidth * scaleX,
    top: rect.top,
    bottom: rect.top + node.clientHeight * scaleY,
  }
}

// A port of prosemirror-view's scrollRectIntoView (1.42.1), minus its
// empty-rect guard: callers here always pass a measured rect. Honors the same
// scrollThreshold / scrollMargin props so the takeover is invisible to them.
function scrollRectIntoView(view: EditorView, rect: Rect, startDOM: Node): void {
  const scrollThreshold: Sides = view.someProp('scrollThreshold') ?? 0
  const scrollMargin: Sides = view.someProp('scrollMargin') ?? 5
  const doc = view.dom.ownerDocument
  for (let parent: Node | null = startDOM; parent;) {
    if (parent.nodeType !== 1) {
      parent = parentNode(parent)
      continue
    }
    const elt = parent as HTMLElement
    const atTop = elt === doc.body
    const bounding = atTop ? windowRect(doc) : clientRect(elt)
    let moveX = 0
    let moveY = 0
    if (rect.top < bounding.top + getSide(scrollThreshold, 'top')) {
      moveY = -(bounding.top - rect.top + getSide(scrollMargin, 'top'))
    } else if (rect.bottom > bounding.bottom - getSide(scrollThreshold, 'bottom')) {
      moveY =
        rect.bottom - rect.top > bounding.bottom - bounding.top
          ? rect.top + getSide(scrollMargin, 'top') - bounding.top
          : rect.bottom - bounding.bottom + getSide(scrollMargin, 'bottom')
    }
    if (rect.left < bounding.left + getSide(scrollThreshold, 'left')) {
      moveX = -(bounding.left - rect.left + getSide(scrollMargin, 'left'))
    } else if (rect.right > bounding.right - getSide(scrollThreshold, 'right')) {
      moveX = rect.right - bounding.right + getSide(scrollMargin, 'right')
    }
    if (moveX || moveY) {
      if (atTop) {
        doc.defaultView?.scrollBy(moveX, moveY)
      } else {
        const startX = elt.scrollLeft
        const startY = elt.scrollTop
        if (moveY) elt.scrollTop += moveY
        if (moveX) elt.scrollLeft += moveX
        const dX = elt.scrollLeft - startX
        const dY = elt.scrollTop - startY
        rect = {
          left: rect.left - dX,
          top: rect.top - dY,
          right: rect.right - dX,
          bottom: rect.bottom - dY,
        }
      }
    }
    const pos = atTop ? 'fixed' : getComputedStyle(elt).position
    if (/^(?:fixed|sticky)$/.test(pos)) break
    parent = pos === 'absolute' ? elt.offsetParent : parentNode(elt)
  }
}

/**
 * Scroll to the selection when the default measurement cannot: a caret on an
 * atom mark view boundary (wikilink, image, file) has no visible box of its
 * own, so `tr.scrollIntoView()` would otherwise silently do nothing there.
 */
export function defineScrollToSelection(): PlainExtension {
  return definePlugin(new Plugin({ key, props: { handleScrollToSelection } }))
}
