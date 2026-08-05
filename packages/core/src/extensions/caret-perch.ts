import { definePlugin, isTextSelection, type PlainExtension } from '@prosekit/core'
import type { EditorState, PluginView } from '@prosekit/pm/state'
import { Plugin, PluginKey } from '@prosekit/pm/state'
import { Decoration, DecorationSet } from '@prosekit/pm/view'
import type { EditorView } from '@prosekit/pm/view'

import { getMarkMode } from './mark-mode.ts'
import { ATOM_SOURCE_MARK_NAMES } from './mark-names.ts'
import { getMarkRangeAfter, getMarkRangeBefore } from './mark-range.ts'

const key = new PluginKey('meowdown-caret-perch')

// Experimental instrumentation for the real-device test sessions. Strip before
// this leaves the experiment branch.
function log(...args: unknown[]): void {
  console.log('[caret-perch]', ...args)
}

interface PerchSpot {
  pos: number
  side: 0 | -1
}

// The caret position whose DOM anchor would land in a hidden atom source, and
// the widget side that intercepts it. prosemirror-view's domFromPos resolves a
// caret at the textblock start through the NEXT child (side +1) and every
// other caret through the end of the PREVIOUS child (side -1); a mark view is
// never a stopping point (border 0, domAtom false), so an atom source on the
// entered side swallows the anchor into its zero-size text. A widget IS a
// stopping point (domAtom true), but only when the child scan can reach it:
// the back-off loop before the scan skips zero-size widgets with side >= 0,
// which is exactly what parks the scan on the widget for the side +1 walk and
// why the side -1 walk needs a side < 0 widget instead.
function findPerchSpot(state: EditorState): PerchSpot | undefined {
  if (getMarkMode(state) == null) return
  const selection = state.selection
  if (!isTextSelection(selection) || !selection.empty) return
  const $head = selection.$head
  if (!$head.parent.isTextblock || $head.parent.type.spec.code) return
  const pos = selection.head
  if ($head.parentOffset === 0) {
    if (getMarkRangeAfter(state, pos, ATOM_SOURCE_MARK_NAMES)) return { pos, side: 0 }
    return
  }
  if (getMarkRangeBefore(state, pos, ATOM_SOURCE_MARK_NAMES)) return { pos, side: -1 }
  return
}

// A zero-width inline box with the surrounding line's height: real geometry
// for the caret to anchor beside, unlike the font-size: 0 atom source. The
// zero-width space lives outside the document (widget DOM is opaque to
// ProseMirror's parser), and contenteditable=false keeps the browser from
// anchoring inside it.
function createPerchDOM(): HTMLElement {
  const span = document.createElement('span')
  span.className = 'md-caret-perch'
  span.contentEditable = 'false'
  span.textContent = '\u{200B}'
  log('perch DOM created')
  return span
}

function buildDecorations(state: EditorState): DecorationSet | null {
  const spot = findPerchSpot(state)
  if (spot == null) return null
  const widget = Decoration.widget(spot.pos, createPerchDOM, {
    key: `md-caret-perch:${spot.side}`,
    side: spot.side,
    // Stay a direct child of the textblock: nested inside the atom's mark
    // spans the anchor would sit in hidden territory again.
    marks: [],
    // Both flags stop prosemirror-view from fighting the browser over which
    // exact side of the perch the DOM selection rests on.
    relaxedSide: true,
    ignoreSelection: true,
    destroy: () => log('perch DOM destroyed'),
  })
  return DecorationSet.create(state.doc, [widget])
}

function describeElement(el: Element | null): string {
  if (el == null) return 'null'
  const name = el.nodeName.toLowerCase()
  const className = typeof el.className === 'string' && el.className ? el.className : ''
  return className ? `${name}.${className.replaceAll(' ', '.')}` : name
}

function describeDOMPosition(node: Node | null, offset: number): string {
  if (node == null) return 'null'
  if (node.nodeType === Node.TEXT_NODE) {
    const text = JSON.stringify((node.nodeValue ?? '').slice(0, 24))
    return `text(${text})@${describeElement(node.parentElement)}+${offset}`
  }
  return `${describeElement(node as Element)}+${offset}`
}

// Console reporter for the oscillation experiment: every selectionchange with
// its DOM anchor, plus perch mount/move/unmount transitions with the mounted
// element's actual DOM parent (the fix only works when that parent is the
// textblock itself, never a mark span).
class PerchLogView implements PluginView {
  readonly #view: EditorView
  #lastSpot = 'none'
  #eventCount = 0
  readonly #start = performance.now()

  constructor(view: EditorView) {
    this.#view = view
    document.addEventListener('selectionchange', this.#handleSelectionChange)
    log('attached; initial spot:', this.#describeSpot())
  }

  update() {
    const spot = this.#describeSpot()
    if (spot === this.#lastSpot) return
    this.#lastSpot = spot
    if (spot === 'none') {
      log(this.#stamp(), 'perch unmounted')
      return
    }
    const el = this.#view.dom.querySelector('.md-caret-perch')
    const parent = el?.parentElement ?? null
    log(
      this.#stamp(),
      `perch ${spot}`,
      `domParent=${describeElement(parent)}`,
      `insideMarkSpan=${String(el?.closest('.md-atom-view, .md-mark') != null)}`,
    )
  }

  destroy() {
    document.removeEventListener('selectionchange', this.#handleSelectionChange)
    log('detached')
  }

  #stamp(): string {
    return (performance.now() - this.#start).toFixed(1)
  }

  #describeSpot(): string {
    const spot = findPerchSpot(this.#view.state)
    return spot == null ? 'none' : `pos=${spot.pos} side=${spot.side}`
  }

  readonly #handleSelectionChange = (): void => {
    const sel = document.getSelection()
    this.#eventCount += 1
    log(
      this.#stamp(),
      `selectionchange #${this.#eventCount}`,
      `anchor=${describeDOMPosition(sel?.anchorNode ?? null, sel?.anchorOffset ?? 0)}`,
      `pmHead=${this.#view.state.selection.head}`,
      `focus=${this.#view.hasFocus()}`,
    )
  }
}

/**
 * Experimental fix for the iOS DOM-anchor oscillation on atom boundaries: a
 * caret-following "perch" widget that gives the DOM selection a real anchor
 * point beside hidden atom sources. At most one widget exists at a time, so
 * the whole-document decoration cost stays O(1).
 */
export function defineCaretPerch(): PlainExtension {
  return definePlugin(
    new Plugin({
      key,
      props: {
        decorations: buildDecorations,
      },
      view: (view) => new PerchLogView(view),
    }),
  )
}
