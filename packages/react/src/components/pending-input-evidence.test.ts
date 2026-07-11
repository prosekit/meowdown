import { Schema } from '@prosekit/pm/model'
import { EditorState } from '@prosekit/pm/state'
import { EditorView } from '@prosekit/pm/view'
import { afterEach, describe, expect, it } from 'vitest'

/**
 * Engine-level evidence for the pending-input reconciliation in
 * `EditorHandle.getMarkdown()` — nothing here is synthetic: no
 * `CompositionEvent` constructors, no manual `textContent` writes. The DOM
 * mutation is performed by the browser's own editing pipeline via
 * `document.execCommand('insertText')`, which is as close to native input as
 * an automated browser test can get (real IME / emoji-palette composition
 * cannot be driven by automation; `composeAndBlurTitle` in
 * `prosekit-editor.test.tsx` still covers the composition-event paths).
 *
 * Three facts, layer by layer:
 *
 * 1. Plain `contenteditable`, no ProseMirror: an engine-performed mutation is
 *    delivered to a `MutationObserver` only after the current task, so any
 *    consumer that reads observer-derived state during the blur turn sees a
 *    stale document — while `takeRecords()` (a synchronous drain) already
 *    sees the mutation.
 * 2. Bare ProseMirror (`@prosekit/pm`, no ProseKit, no Meowdown): the same
 *    mutation is therefore missing from `view.state` during the blur turn,
 *    and `DOMObserver.stop()` (ProseMirror's blur handler) parks it behind a
 *    20ms timer, so the state converges only a turn later.
 * 3. Draining the observer (`forceFlush()` + `flush()`) — exactly what
 *    `ProseKitEditor.getMarkdown()` now does — closes that gap synchronously.
 *
 * The suite runs on every CI engine; the `test-mac-webkit` lane is the
 * real-Safari proof requested in review.
 */

const mounted: Array<() => void> = []

afterEach(() => {
  for (const dispose of mounted) dispose()
  mounted.length = 0
})

function mountContentEditable(text: string): HTMLDivElement {
  const host = document.createElement('div')
  host.contentEditable = 'true'
  host.textContent = text
  document.body.appendChild(host)
  mounted.push(() => host.remove())
  return host
}

function placeCaretAtStart(host: HTMLElement): void {
  const selection = window.getSelection()
  if (!selection || !host.firstChild) throw new Error('expected a selection and a text node')
  const range = document.createRange()
  range.setStart(host.firstChild, 0)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

/** Insert through the engine's editing pipeline; fail loud if it refused. */
function engineInsertText(text: string): void {
  if (!document.execCommand('insertText', false, text)) {
    throw new Error('the engine refused execCommand insertText')
  }
}

const schema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: {
      content: 'text*',
      toDOM: () => ['p', 0] as const,
      parseDOM: [{ tag: 'p' }],
    },
    text: {},
  },
})

function mountBareProseMirror(text: string): EditorView {
  const place = document.createElement('div')
  document.body.appendChild(place)
  const doc = schema.node('doc', null, [schema.node('paragraph', null, [schema.text(text)])])
  const view = new EditorView(place, { state: EditorState.create({ doc }) })
  mounted.push(() => {
    view.destroy()
    place.remove()
  })
  return view
}

describe('engine-performed input around blur (no synthetic events)', () => {
  it('a plain contenteditable mutation is invisible to a MutationObserver during the blur turn', () => {
    const host = mountContentEditable('Business ideas')
    let delivered = ''
    const observer = new MutationObserver(() => {
      delivered = host.textContent ?? ''
    })
    observer.observe(host, { childList: true, characterData: true, subtree: true })

    host.focus()
    placeCaretAtStart(host)
    engineInsertText('🧠 ')

    let deliveredAtBlur = 'blur listener never ran'
    let queuedAtBlur = -1
    host.addEventListener(
      'blur',
      () => {
        deliveredAtBlur = delivered
        queuedAtBlur = observer.takeRecords().length
      },
      { once: true },
    )
    host.blur()
    observer.disconnect()

    // The engine wrote the DOM…
    expect(host.textContent).toBe('🧠 Business ideas')
    // …but the observer callback had not run inside the blur turn — a host
    // serializing observer-derived state there reads the pre-input document…
    expect(deliveredAtBlur).toBe('')
    // …while a synchronous drain (what the reconciliation does) already saw
    // the queued mutation records in that same turn.
    expect(queuedAtBlur).toBeGreaterThan(0)
  })

  it('bare ProseMirror state misses the mutation during the blur turn and converges a timer later', async () => {
    const view = mountBareProseMirror('Business ideas')
    view.focus()
    engineInsertText('🧠 ')
    view.dom.blur()

    expect(view.dom.textContent).toBe('🧠 Business ideas')
    // Stale in the blur turn: the record is parked behind DOMObserver.stop()'s
    // 20ms timer, past any synchronous save.
    expect(view.state.doc.textContent).toBe('Business ideas')

    await new Promise((resolve) => setTimeout(resolve, 40))
    expect(view.state.doc.textContent).toBe('🧠 Business ideas')
  })

  it('draining the observer closes the gap synchronously — the getMarkdown reconciliation', () => {
    const view = mountBareProseMirror('Business ideas')
    view.focus()
    engineInsertText('🧠 ')
    view.dom.blur()

    expect(view.state.doc.textContent).toBe('Business ideas')

    // The exact guarded reach-in ProseKitEditor.getMarkdown() ships.
    const observer: unknown = Reflect.get(view, 'domObserver')
    if (typeof observer !== 'object' || observer === null) {
      throw new Error('expected ProseMirror to expose a domObserver')
    }
    const forceFlush: unknown = Reflect.get(observer, 'forceFlush')
    const flush: unknown = Reflect.get(observer, 'flush')
    if (typeof flush !== 'function') throw new Error('expected domObserver.flush')
    if (typeof forceFlush === 'function') forceFlush.call(observer)
    flush.call(observer)

    expect(view.state.doc.textContent).toBe('🧠 Business ideas')
  })
})
