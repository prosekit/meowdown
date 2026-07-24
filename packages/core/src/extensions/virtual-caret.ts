import { definePlugin, isTextSelection, type PlainExtension } from '@prosekit/core'
import type { EditorState, PluginView } from '@prosekit/pm/state'
import { Plugin, PluginKey } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

import { forceReflow } from '../utils/force-reflow.ts'

import {
  findAtomCaretRect,
  findCoordsCaretRect,
  findNativeCaretRect,
  type CaretRect,
} from './caret-rect.ts'
import { getCaretTail, type CaretTail } from './hidden-run.ts'
import { getMarkMode } from './mark-mode.ts'

const key = new PluginKey('meowdown-virtual-caret')

const BLINK_ANIMATIONS = ['md-virtual-caret-blink', 'md-virtual-caret-blink2'] as const

const DATA_ATTRIBUTE = 'data-meowdown-virtual-caret'

// The measured rect is the glyph box, which reads short against the airy
// line-height; stand the caret taller around its center.
const CARET_STRETCH = 1.2

function stretchCaretRect(rect: CaretRect): CaretRect {
  const extra = rect.height * (CARET_STRETCH - 1)
  return { left: rect.left, top: rect.top - extra / 2, height: rect.height + extra }
}

function measureCaretRect(view: EditorView): CaretRect | undefined {
  const rect = findNativeCaretRect(view) ?? findCoordsCaretRect(view)
  if (rect != null) return stretchCaretRect(rect)
  return findAtomCaretRect(view)
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
class VirtualCaretView implements PluginView {
  readonly #view: EditorView
  readonly #layer: HTMLElement
  readonly #caret: HTMLElement
  readonly #document: Document
  readonly #resizeObserver: ResizeObserver | undefined
  #lastRect: CaretRect | undefined
  #lastTail: CaretTail | undefined
  #blinkIndex = 0

  constructor(view: EditorView) {
    this.#view = view
    this.#document = view.dom.ownerDocument
    this.#layer = this.#document.createElement('div')
    this.#layer.className = 'md-virtual-caret-layer'
    this.#caret = this.#layer.appendChild(this.#document.createElement('div'))
    this.#caret.className = 'md-virtual-caret'
    this.#caret.dataset.testid = 'virtual-caret'
    view.dom.insertAdjacentElement('afterend', this.#layer)
    this.#document.addEventListener('selectionchange', this.#reposition)
    if (typeof ResizeObserver !== 'undefined') {
      this.#resizeObserver = new ResizeObserver(this.#reposition)
      this.#resizeObserver.observe(view.dom)
    }
    this.#reposition()
  }

  update(view: EditorView, prevState: EditorState) {
    if (!view.state.selection.eq(prevState.selection)) this.#restartBlink()
    this.#reposition()
  }

  destroy() {
    this.#document.removeEventListener('selectionchange', this.#reposition)
    this.#resizeObserver?.disconnect()
    this.#layer.remove()
  }

  #restartBlink() {
    this.#blinkIndex = 1 - this.#blinkIndex
    this.#caret.style.animationName = BLINK_ANIMATIONS[this.#blinkIndex]
  }

  readonly #reposition = (): void => {
    const view = this.#view
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
    if (sameRect(rect, this.#lastRect) && tail === this.#lastTail) return
    const wasHidden = this.#lastRect == null
    this.#lastRect = rect
    this.#lastTail = tail
    if (tail == null) {
      delete this.#caret.dataset.tail
    } else {
      this.#caret.dataset.tail = tail
    }
    if (rect == null) {
      this.#caret.style.visibility = 'hidden'
      view.dom.removeAttribute(DATA_ATTRIBUTE)
      return
    }
    const layerRect = this.#layer.getBoundingClientRect()
    // A reappearing caret must not glide in from its stale position.
    if (wasHidden) this.#caret.style.transitionProperty = 'none'
    this.#caret.style.visibility = ''
    this.#caret.style.left = `${rect.left - layerRect.left}px`
    this.#caret.style.top = `${rect.top - layerRect.top}px`
    this.#caret.style.height = `${rect.height}px`
    view.dom.setAttribute(DATA_ATTRIBUTE, '')
    if (wasHidden) {
      forceReflow(this.#caret)
      this.#caret.style.transitionProperty = ''
    }
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
