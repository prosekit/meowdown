import { definePlugin, isTextSelection, type PlainExtension } from '@prosekit/core'
import type { EditorState, PluginView } from '@prosekit/pm/state'
import { Plugin, PluginKey } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

import { forceReflow } from '../utils/force-reflow.ts'
import { getIsTouchInput, onIsTouchInputChange } from '../utils/input-modality.ts'
import { isAfterLineBreak_v2_tmp } from '../utils/is-after-line-break.ts'

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

function measureCaretRect(
  view: EditorView,
  nativeRect: CaretRect | undefined,
): CaretRect | undefined {
  const rect = nativeRect ?? findCoordsCaretRect(view)
  if (rect != null) return stretchCaretRect(rect)
  return findAtomCaretRect(view)
}

function sameRect(a: CaretRect | undefined, b: CaretRect | undefined): boolean {
  if (a == null || b == null) return a === b
  return a.left === b.left && a.top === b.top && a.height === b.height
}

// The caret draws into a host-owned zero-size in-flow layer, never inside the
// contenteditable: a `contenteditable=false` element inside the content DOM
// shifts the browser's insertion point at the document edges (Chrome inserts
// typed text before the element instead of into the first textblock). The
// layer must live outside `view.dom` and scroll together with the content;
// the caret's coordinates are re-derived from the layer's own measured rect,
// so its exact placement is free and no positioned ancestor is required.
class VirtualCaretView implements PluginView {
  readonly #view: EditorView
  readonly #layer: HTMLElement
  readonly #caret: HTMLElement
  readonly #document: Document
  readonly #resizeObserver: ResizeObserver | undefined
  readonly #unsubscribeModality: () => void
  #lastRect: CaretRect | undefined
  #lastTail: CaretTail | undefined
  #blinkIndex = 0
  #repositionRequested = false

  constructor(view: EditorView, layer: HTMLElement) {
    this.#view = view
    this.#document = view.dom.ownerDocument
    this.#layer = layer
    this.#layer.classList.add('md-virtual-caret-layer')
    this.#caret = this.#layer.appendChild(this.#document.createElement('div'))
    this.#caret.className = 'md-virtual-caret'
    this.#caret.dataset.testid = 'virtual-caret'
    this.#document.addEventListener('selectionchange', this.#requestReposition)
    this.#unsubscribeModality = onIsTouchInputChange(this.#requestReposition)
    view.dom.addEventListener('focus', this.#handleFocus)
    view.dom.addEventListener('blur', this.#handleBlur)
    if (typeof ResizeObserver !== 'undefined') {
      this.#resizeObserver = new ResizeObserver(this.#requestReposition)
      this.#resizeObserver.observe(view.dom)
    }
    if (view.hasFocus()) this.#handleFocus()
    this.#requestReposition()
  }

  update(view: EditorView, prevState: EditorState) {
    if (!view.state.selection.eq(prevState.selection)) this.#restartBlink()
    this.#requestReposition()
  }

  destroy() {
    this.#document.removeEventListener('selectionchange', this.#requestReposition)
    this.#unsubscribeModality()
    this.#view.dom.removeEventListener('focus', this.#handleFocus)
    this.#view.dom.removeEventListener('blur', this.#handleBlur)
    this.#resizeObserver?.disconnect()
    this.#caret.remove()
    this.#layer.classList.remove('md-virtual-caret-layer')
    delete this.#layer.dataset.focused
    this.#view.dom.removeAttribute(DATA_ATTRIBUTE)
  }

  readonly #handleFocus = (): void => {
    this.#layer.dataset.focused = ''
  }

  readonly #handleBlur = (): void => {
    delete this.#layer.dataset.focused
  }

  #restartBlink() {
    this.#blinkIndex = 1 - this.#blinkIndex
    this.#caret.style.animationName = BLINK_ANIMATIONS[this.#blinkIndex]
  }

  readonly #requestReposition = (): void => {
    if (this.#repositionRequested === true) return
    this.#repositionRequested = true

    queueMicrotask(this.#reposition)
  }

  readonly #reposition = () => {
    if (this.#repositionRequested === false) return
    this.#repositionRequested = false

    const view = this.#view
    if (view.isDestroyed || !view.hasFocus()) return

    const state = view.state
    const selection = state.selection
    const drawable = isTextSelection(selection) && selection.empty

    if (!drawable) {
      this.#renderTail()
      this.#renderCaret()
      return
    }

    const skipNativeCaretRect = isAfterLineBreak_v2_tmp(selection.$head)
    const nativeRect = skipNativeCaretRect ? undefined : findNativeCaretRect(view)

    // Use the native rect if it exists and the last input modality was touch.
    // This ensures that we can render the drag magnifier on touch devices.
    if (nativeRect && getIsTouchInput()) {
      this.#renderTail()
      this.#renderCaret()
      return
    }

    const viewportRect = measureCaretRect(view, nativeRect)
    let rect: CaretRect | undefined
    if (viewportRect != null) {
      const layerRect = this.#layer.getBoundingClientRect()
      rect = {
        left: viewportRect.left - layerRect.left,
        top: viewportRect.top - layerRect.top,
        height: viewportRect.height,
      }
    }
    // In hide mode the two doc positions at a hidden run boundary render at
    // one x; the tail (typing affinity) tells them apart.
    const tail =
      rect != null && getMarkMode(state) === 'hide' && !getIsTouchInput()
        ? getCaretTail(state, selection.head)
        : undefined
    this.#renderTail(tail)
    this.#renderCaret(rect)
  }

  #renderTail(tail?: CaretTail) {
    if (tail === this.#lastTail) return
    this.#lastTail = tail

    if (tail == null) {
      delete this.#caret.dataset.tail
    } else {
      this.#caret.dataset.tail = tail
    }
  }

  #renderCaret(rect?: CaretRect) {
    if (sameRect(rect, this.#lastRect)) return
    const wasHidden = !this.#lastRect
    this.#lastRect = rect
    const view = this.#view

    if (rect == null) {
      this.#caret.style.visibility = 'hidden'
      view.dom.removeAttribute(DATA_ATTRIBUTE)
      return
    }

    // A reappearing caret must not glide in from its stale position.
    if (wasHidden) this.#caret.style.transitionProperty = 'none'
    this.#caret.style.visibility = ''
    this.#caret.style.left = `${rect.left}px`
    this.#caret.style.top = `${rect.top}px`
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
 *
 * On a touch screen, while the last input was a finger or pen
 * ({@link getIsTouchInput}), the roles flip: the native caret stays visible
 * (it carries the system touch affordances: the drag magnifier, the caret-drag
 * long-press mode) and the virtual caret draws only at positions where the
 * native caret has no geometry, such as beside hidden Markdown syntax.
 *
 * `layer` is the element the caret draws into. The host owns its placement:
 * it must live outside the contenteditable and scroll together with the
 * content.
 */
export function defineVirtualCaret(layer: HTMLElement): PlainExtension {
  return definePlugin(
    new Plugin({
      key,
      view: (view) => new VirtualCaretView(view, layer),
    }),
  )
}
