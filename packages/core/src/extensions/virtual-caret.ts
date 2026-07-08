import { definePlugin, isTextSelection, type PlainExtension } from '@prosekit/core'
import type { EditorState, PluginView } from '@prosekit/pm/state'
import { Plugin, PluginKey } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

import { tryCoordsAtPos } from '../utils/caret-coords.ts'
import { forceReflow } from '../utils/force-reflow.ts'

import { ATOM_SOURCE_MARK_NAMES } from './atom-mark-navigation.ts'
import { getMarkRangeAt } from './get-mark-range-at.ts'
import {
  getCaretTail,
  getHiddenRunAfter,
  getHiddenRunBefore,
  type CaretTail,
} from './hidden-run.ts'
import { getMarkMode } from './mark-mode.ts'

// Plugin state counts transactions that explicitly set the selection, so the
// view can tell a deliberate caret placement from a selection that merely got
// remapped by a doc change elsewhere — only the former may scroll, matching
// ProseMirror's opt-in `scrollIntoView` convention. A counter rather than the
// last transaction's `selectionSet` flag: other plugins append transactions
// after a selection-setting one within a single dispatch, which would
// otherwise mask it.
const key = new PluginKey<number>('meowdown-virtual-caret')

const BLINK_ANIMATIONS = ['md-virtual-caret-blink', 'md-virtual-caret-blink2'] as const

// The measured rect is the glyph box, which reads short against the airy
// line-height; stand the caret taller around its center.
const CARET_STRETCH = 1.2

// Breathing room kept between a revealed caret and the viewport edge, so the
// caret does not sit flush against the boundary after a scroll.
const SCROLL_MARGIN = 16

// How long a focus keeps re-revealing the caret through layout churn. The
// reveal at focus time runs against the pre-keyboard layout: the iOS
// software keyboard reports its height only once it animates up, and a
// keyboard-aware host shell then shrinks the editor's scroller by that
// height — dropping an end-of-note caret below the fold with nothing left
// to re-scroll it. Long notes also keep growing after focus as images size
// in. Each disturbance re-arms the window; a pointerdown or wheel anywhere
// ends it, because the user has taken over.
const REVEAL_WINDOW_MS = 1500

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
  const preferredBeforeSide: boolean = runBefore == null
  // `side` picks which neighbor to measure: -1 the character before the
  // position, 1 the character after it.
  const probes: [pos: number, beforeSide: boolean][] = [
    [head, preferredBeforeSide],
    [head, !preferredBeforeSide],
  ]
  if (runBefore != null) probes.push([runBefore.from, true])
  if (runAfter != null) probes.push([runAfter.to, false])
  for (const [pos, beforeSide] of probes) {
    const coords = tryCoordsAtPos(view, pos, beforeSide ? -1 : 1)
    if (coords != null && coords.bottom > coords.top) {
      return { left: coords.left, top: coords.top, height: coords.bottom - coords.top }
    }
  }
  return undefined
}

// Step 3: an atom mark view collapses its source text to a zero-size box
// (font-size: 0), so no position beside it has a box the earlier steps can
// measure. The preview element standing in for the source is the visible
// geometry; the caret sits flush against its outer edge.
function findAtomCaretRect(view: EditorView): CaretRect | undefined {
  const state = view.state
  const head = state.selection.head
  for (const markName of ATOM_SOURCE_MARK_NAMES) {
    const range = getMarkRangeAt(state, head, markName)
    if (range == null || (range.from !== head && range.to !== head)) continue
    const preview = findAtomPreviewElement(view, range.from + 1)
    if (preview == null) continue
    const rect = preview.getBoundingClientRect()
    if (rect.height === 0) continue
    const left = range.to === head ? rect.right : rect.left
    return { left, top: rect.top, height: rect.height }
  }
  return undefined
}

function findAtomPreviewElement(view: EditorView, insidePos: number): Element | undefined {
  const { node } = view.domAtPos(insidePos, 0)
  const element = node instanceof Element ? node : node.parentElement
  const preview = element?.closest('.md-atom-view')?.querySelector('.md-atom-view-preview')
  return preview ?? undefined
}

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

// The nearest ancestor that can scroll vertically, or the page scroller.
function closestScrollable(element: Element): Element | null {
  for (let node = element.parentElement; node != null; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if (
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      node.scrollHeight > node.clientHeight
    ) {
      return node
    }
  }
  return element.ownerDocument.scrollingElement
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
  #revealPending = false
  #revealUntil = 0
  #pointerActive = false
  #selectionSetsSeen: number
  readonly #revealWindowObserver: ResizeObserver | undefined
  readonly #visualViewport: VisualViewport | null

  constructor(view: EditorView) {
    this.#view = view
    this.#selectionSetsSeen = key.getState(view.state) ?? 0
    this.#document = view.dom.ownerDocument
    this.#visualViewport = this.#document.defaultView?.visualViewport ?? null
    this.#layer = this.#document.createElement('div')
    this.#layer.className = 'md-virtual-caret-layer'
    this.#caret = this.#layer.appendChild(this.#document.createElement('div'))
    this.#caret.className = 'md-virtual-caret'
    this.#caret.dataset.testid = 'virtual-caret'
    view.dom.insertAdjacentElement('afterend', this.#layer)
    this.#document.addEventListener('selectionchange', this.#reposition)
    view.dom.addEventListener('focusin', this.#handleFocusIn)
    view.dom.addEventListener('pointerdown', this.#handlePointerDown)
    this.#document.addEventListener('pointerup', this.#handlePointerRelease)
    this.#document.addEventListener('pointercancel', this.#handlePointerRelease)
    this.#document.addEventListener('pointerdown', this.#cancelRevealWindow)
    this.#document.addEventListener('wheel', this.#cancelRevealWindow, { passive: true })
    this.#document.addEventListener('scroll', this.#handleLayoutShift, {
      capture: true,
      passive: true,
    })
    this.#visualViewport?.addEventListener('resize', this.#handleLayoutShift)
    if (typeof ResizeObserver !== 'undefined') {
      this.#resizeObserver = new ResizeObserver(this.#reposition)
      this.#resizeObserver.observe(view.dom)
      this.#revealWindowObserver = new ResizeObserver(this.#handleLayoutShift)
    }
    this.#reposition()
  }

  update(view: EditorView, prevState: EditorState) {
    if (!view.state.selection.eq(prevState.selection)) this.#restartBlink()
    const selectionSets = key.getState(view.state) ?? 0
    if (selectionSets !== this.#selectionSetsSeen) {
      this.#selectionSetsSeen = selectionSets
      // A pointer places the caret where the user can already see it, and
      // scrolling between pointerdown and the click's selection dispatch
      // would displace the click.
      if (view.hasFocus() && !this.#pointerActive) this.#revealPending = true
    }
    this.#reposition()
  }

  destroy() {
    this.#document.removeEventListener('selectionchange', this.#reposition)
    this.#view.dom.removeEventListener('focusin', this.#handleFocusIn)
    this.#view.dom.removeEventListener('pointerdown', this.#handlePointerDown)
    this.#document.removeEventListener('pointerup', this.#handlePointerRelease)
    this.#document.removeEventListener('pointercancel', this.#handlePointerRelease)
    this.#document.removeEventListener('pointerdown', this.#cancelRevealWindow)
    this.#document.removeEventListener('wheel', this.#cancelRevealWindow)
    this.#document.removeEventListener('scroll', this.#handleLayoutShift, { capture: true })
    this.#visualViewport?.removeEventListener('resize', this.#handleLayoutShift)
    this.#resizeObserver?.disconnect()
    this.#revealWindowObserver?.disconnect()
    this.#layer.remove()
  }

  // Focus is what makes the caret appear (CSS displays it only under
  // `.ProseMirror-focused`), and `EditorView.focus` restores the selection
  // without scrolling, so a programmatic focus deep in a long document would
  // otherwise leave the caret off-screen. The reveal window arms even for a
  // pointer-driven focus: the tap's own placement is visible, but the
  // keyboard it raises can still push the caret off afterwards.
  readonly #handleFocusIn = (): void => {
    if (!this.#pointerActive) this.#revealPending = true
    this.#armRevealWindow()
    this.#reposition()
  }

  #armRevealWindow(): void {
    this.#revealUntil = performance.now() + REVEAL_WINDOW_MS
    const observer = this.#revealWindowObserver
    if (observer == null) return
    observer.disconnect()
    // Watch every ancestor: the keyboard-raise shrink lands on whichever
    // element the host sizes against the keyboard, and a shrinking scroller
    // fires no scroll event of its own.
    for (let node = this.#layer.parentElement; node != null; node = node.parentElement) {
      observer.observe(node)
    }
  }

  readonly #cancelRevealWindow = (): void => {
    this.#revealUntil = 0
    this.#revealPending = false
    this.#revealWindowObserver?.disconnect()
  }

  // A layout disturbance while the reveal window is open — the keyboard
  // raise shrinking an ancestor, late content growth, the visual viewport
  // resizing, a stray non-user scroll (iOS WebKit nudging toward the newly
  // focused element) — re-reveals the caret and re-arms the window. User
  // scrolls always lead with a pointerdown or a wheel event, which close
  // the window before their scroll arrives here.
  readonly #handleLayoutShift = (): void => {
    if (performance.now() > this.#revealUntil) return
    this.#revealUntil = performance.now() + REVEAL_WINDOW_MS
    this.#reposition()
  }

  readonly #handlePointerDown = (): void => {
    this.#pointerActive = true
  }

  // ProseMirror dispatches a click's selection from its own document-level
  // mouseup listener, which can run after this one; clearing in a microtask
  // keeps the flag raised through that dispatch.
  readonly #handlePointerRelease = (): void => {
    queueMicrotask(() => {
      this.#pointerActive = false
    })
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
    const showsCaret = isTextSelection(selection) && selection.empty
    const rect = showsCaret ? measureCaretRect(view) : undefined
    if (!showsCaret) this.#revealPending = false
    // In hide mode the two doc positions at a hidden run boundary render at
    // one x; the tail (typing affinity) tells them apart.
    const tail =
      rect != null && getMarkMode(state) === 'hide'
        ? getCaretTail(state, selection.head)
        : undefined
    if (sameRect(rect, this.#lastRect) && tail === this.#lastTail) {
      this.#revealIfPending()
      return
    }
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
      return
    }
    const layerRect = this.#layer.getBoundingClientRect()
    // A reappearing caret must not glide in from its stale position.
    if (wasHidden) this.#caret.style.transitionProperty = 'none'
    this.#caret.style.visibility = ''
    this.#caret.style.left = `${rect.left - layerRect.left}px`
    this.#caret.style.top = `${rect.top - layerRect.top}px`
    this.#caret.style.height = `${rect.height}px`
    if (wasHidden) {
      forceReflow(this.#caret)
      this.#caret.style.transitionProperty = ''
    }
    this.#revealIfPending()
  }

  // Consumes a pending reveal — or re-reveals while the reveal window is
  // open — by scrolling the caret's destination into view. The target is
  // measured from the editor state, never the native selection: right after
  // a focus the browser has parked the DOM selection at the start of the
  // contenteditable and ProseMirror restores it a beat later, so the native
  // rect can point at the wrong place. An unmeasurable target (host not
  // laid out yet) keeps the flag raised; the ResizeObserver retries once
  // layout settles.
  #revealIfPending(): void {
    if (!this.#revealPending && performance.now() > this.#revealUntil) return
    const view = this.#view
    if (!view.hasFocus()) return
    const selection = view.state.selection
    if (!isTextSelection(selection) || !selection.empty) return
    const rect = findCoordsCaretRect(view) ?? findAtomCaretRect(view)
    if (rect == null) return
    this.#revealPending = false
    this.#scrollRectIntoView(rect)
  }

  // Scrolls the minimum distance to bring the caret's destination into view,
  // via a phantom sibling at that spot: the caret element itself glides there
  // (left/top transition), so its own box may still be mid-flight, and
  // `scrollIntoView` on a phantom walks nested scrollers for free. With
  // `nearest` the call is a no-op when the caret is already visible.
  #scrollRectIntoView(rect: CaretRect): void {
    const layerRect = this.#layer.getBoundingClientRect()
    const phantom = this.#document.createElement('div')
    const style = phantom.style
    style.position = 'absolute'
    style.left = `${rect.left - layerRect.left}px`
    style.top = `${rect.top - layerRect.top}px`
    style.width = '2px'
    style.height = `${rect.height}px`
    style.setProperty('scroll-margin', `${SCROLL_MARGIN}px`)
    this.#layer.appendChild(phantom)
    phantom.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    this.#nudgeAboveKeyboard(phantom)
    phantom.remove()
  }

  // `scrollIntoView` clamps to the layout viewport, but a software keyboard
  // can overlay it, leaving only the shorter visual viewport actually
  // visible. (Hosts whose layout tracks the keyboard never hit this — their
  // scrollers already end at the keyboard's top.) Nudge the nearest
  // scroller the rest of the way so the caret clears the keyboard.
  #nudgeAboveKeyboard(phantom: HTMLElement): void {
    const viewport = this.#visualViewport
    if (viewport == null) return
    const visibleBottom = viewport.offsetTop + viewport.height - SCROLL_MARGIN
    const overflow = phantom.getBoundingClientRect().bottom - visibleBottom
    if (overflow <= 0) return
    const scroller = closestScrollable(phantom)
    if (scroller != null) scroller.scrollTop += overflow
  }
}

/**
 * Draws the caret as an overlay element and hides the native caret via CSS
 * (`caret-color: transparent`). The native DOM selection stays fully alive,
 * so IME, clicks, and typing keep their native behavior; only the caret pixels
 * are ours. Applies to every mark mode.
 *
 * A caret placed off-screen — focus restored at the end of a long document,
 * or a keyboard/programmatic selection move — is revealed by scrolling the
 * nearest scroller the minimum distance. Only explicit placements count: a
 * doc change that merely remaps the selection never scrolls, and neither
 * does pointer-driven placement (a click already happens inside the
 * viewport).
 *
 * A focus also opens a reveal window ({@link REVEAL_WINDOW_MS}) that keeps
 * the caret visible through the layout churn that follows — the software
 * keyboard raising and shrinking the host shell, images sizing in — until
 * the layout goes quiet or the user takes over with a pointer or wheel.
 */
export function defineVirtualCaret(): PlainExtension {
  return definePlugin(
    new Plugin({
      key,
      state: {
        init: () => 0,
        apply: (tr, count) => (tr.selectionSet ? count + 1 : count),
      },
      view: (view) => new VirtualCaretView(view),
    }),
  )
}
