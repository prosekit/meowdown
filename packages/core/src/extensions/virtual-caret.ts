import { definePlugin, isTextSelection, type PlainExtension } from '@prosekit/core'
import type { EditorState } from '@prosekit/pm/state'
import { Plugin, PluginKey } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

import { tryCoordsAtPos } from '../utils/caret-coords.ts'

import {
  getCaretTail,
  getHiddenRunAfter,
  getHiddenRunBefore,
  type CaretTail,
} from './hidden-run.ts'
import { getMarkMode } from './mark-mode.ts'

const key = new PluginKey('meowdown-virtual-caret')

const BLINK_ANIMATIONS = ['md-virtual-caret-blink', 'md-virtual-caret-blink2'] as const

interface CaretRect {
  left: number
  top: number
  height: number
}

// Step 1: the collapsed native selection range. The browser resolves fonts,
// baselines, and bidi for us. At a line wrap Chrome reports two rects and the
// last one is the start of the next visual line, which is where the caret
// belongs.
function findNativeCaretRect(view: EditorView): CaretRect | undefined {
  const selection = view.dom.ownerDocument.getSelection()
  if (selection == null || selection.rangeCount === 0) return undefined
  if (!view.dom.contains(selection.anchorNode)) return undefined
  const range = selection.getRangeAt(0).cloneRange()
  range.collapse(true)
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.height > 0)
  if (rects.length === 0) return undefined
  const rect = rects[rects.length - 1]
  return { left: rect.left, top: rect.top, height: rect.height }
}

// Step 2: coordsAtPos with the side biased toward a visible neighbor. Every
// position touching a hidden run shares one visual point (the run has zero
// width), so when the head itself measures flat we probe from the run's far
// ends instead.
function findCoordsCaretRect(view: EditorView): CaretRect | undefined {
  const state = view.state
  const head = state.selection.head
  const runBefore = getHiddenRunBefore(state, head)
  const runAfter = getHiddenRunAfter(state, head)
  const preferredSide: -1 | 1 = runBefore == null ? -1 : 1
  const probes: Array<{ pos: number; side: -1 | 1 }> = [
    { pos: head, side: preferredSide },
    { pos: head, side: -preferredSide as -1 | 1 },
  ]
  if (runBefore != null) probes.push({ pos: runBefore.from, side: -1 })
  if (runAfter != null) probes.push({ pos: runAfter.to, side: 1 })
  for (const probe of probes) {
    const coords = tryCoordsAtPos(view, probe.pos, probe.side)
    if (coords != null && coords.bottom > coords.top) {
      return { left: coords.left, top: coords.top, height: coords.bottom - coords.top }
    }
  }
  return undefined
}

function measureCaretRect(view: EditorView): CaretRect | undefined {
  return findNativeCaretRect(view) ?? findCoordsCaretRect(view)
}

function sameRect(left: CaretRect | undefined, right: CaretRect | undefined): boolean {
  if (left == null || right == null) return left === right
  return left.left === right.left && left.top === right.top && left.height === right.height
}

// The caret lives in a zero-height in-flow layer right after `view.dom`, never
// inside the contenteditable: a `contenteditable=false` element inside the
// content DOM shifts the browser's insertion point at the document edges
// (Chrome inserts typed text before the element instead of into the first
// textblock). The layer moves with the content when the host scrolls, and the
// caret's coordinates are re-derived from the layer's own measured rect, so no
// positioned ancestor is required.
class VirtualCaretView {
  // REVIEW: do not use `private`. Use `#`.
  private readonly view: EditorView
  private readonly layer: HTMLElement
  private readonly caret: HTMLElement
  private readonly document: Document
  private readonly resizeObserver: ResizeObserver | undefined
  private lastRect: CaretRect | undefined
  private lastTail: CaretTail | undefined
  private blinkIndex = 0

  constructor(view: EditorView) {
    this.view = view
    this.document = view.dom.ownerDocument
    this.layer = this.document.createElement('div')
    this.layer.className = 'md-virtual-caret-layer'
    this.caret = this.layer.appendChild(this.document.createElement('div'))
    this.caret.className = 'md-virtual-caret'
    this.caret.dataset.testid = 'virtual-caret'
    view.dom.insertAdjacentElement('afterend', this.layer)
    this.document.addEventListener('selectionchange', this.reposition)
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.reposition)
      this.resizeObserver.observe(view.dom)
    }
    this.reposition()
  }

  update(view: EditorView, prevState: EditorState) {
    if (!view.state.selection.eq(prevState.selection)) this.restartBlink()
    this.reposition()
  }

  destroy() {
    this.document.removeEventListener('selectionchange', this.reposition)
    this.resizeObserver?.disconnect()
    this.layer.remove()
  }

  private restartBlink() {
    this.blinkIndex = 1 - this.blinkIndex
    this.caret.style.animationName = BLINK_ANIMATIONS[this.blinkIndex]
  }

  private readonly reposition = (): void => {
    const view = this.view
    if (view.isDestroyed) return
    const state = view.state
    const selection = state.selection
    const rect = isTextSelection(selection) && selection.empty ? measureCaretRect(view) : undefined
    // In hide mode the two doc positions at a hidden run boundary render at
    // one x; the tail (typing affinity) tells them apart.
    const tail =
      rect != null && getMarkMode(state) === 'hide'
        ? getCaretTail(state, selection.head)
        : undefined
    if (sameRect(rect, this.lastRect) && tail === this.lastTail) return
    this.lastRect = rect
    this.lastTail = tail
    if (tail == null) {
      delete this.caret.dataset.tail
    } else {
      this.caret.dataset.tail = tail
    }
    if (rect == null) {
      this.caret.style.visibility = 'hidden'
      return
    }
    const layerRect = this.layer.getBoundingClientRect()
    this.caret.style.visibility = ''
    this.caret.style.left = `${rect.left - layerRect.left}px`
    this.caret.style.top = `${rect.top - layerRect.top}px`
    this.caret.style.height = `${rect.height}px`
  }
}

/**
 * Draws the caret as an overlay element and hides the native caret via CSS
 * (`caret-color: transparent`). The native DOM selection stays fully alive,
 * so IME, clicks, and typing keep their native behavior; only the caret pixels
 * are ours. Applies to every mark mode.
 */
export function defineVirtualCaret(): PlainExtension {
  return definePlugin(
    new Plugin({
      key,
      view: (view) => new VirtualCaretView(view),
    }),
  )
}
