import { defineMarkView, type PlainExtension } from '@prosekit/core'
import type { Mark } from '@prosekit/pm/model'
import { TextSelection } from '@prosekit/pm/state'
import type { EditorView, MarkView, ViewMutationRecord } from '@prosekit/pm/view'

import { loadKaTeX } from '../utils/katex.ts'

import type { MdMathAttrs } from './inline-marks.ts'
import type { MarkName } from './mark-names.ts'

/**
 * Renders one inline math unit: a KaTeX preview next to the editable
 * `$formula$` source. CSS decides which of the two is visible; in hide and
 * focus modes the source collapses (`font-size: 0`) and the preview shows,
 * unless the caret is inside the unit (the `.show` reveal decoration), which
 * flips it back.
 */
class MathMarkView implements MarkView {
  readonly #dom: HTMLElement
  readonly #contentDOM: HTMLElement
  readonly #preview: HTMLElement
  #formula: string

  constructor(mark: Mark, view: EditorView) {
    this.#formula = (mark.attrs as MdMathAttrs).formula

    this.#dom = document.createElement('span')
    this.#dom.className = 'md-math-view'

    this.#preview = document.createElement('span')
    this.#preview.className = 'md-math-view-preview'
    this.#preview.dataset.testid = 'math-preview'
    this.#preview.contentEditable = 'false'
    // A non-editable preview swallows clicks, so place the caret at the start
    // of the source ourselves; the reveal decoration then swaps it in.
    this.#preview.addEventListener('mousedown', (event) => {
      event.preventDefault()
      const pos = view.posAtDOM(this.#contentDOM, 0)
      if (pos < 0) return
      const selection = TextSelection.near(view.state.doc.resolve(pos), 1)
      view.dispatch(view.state.tr.setSelection(selection))
      view.focus()
    })

    this.#contentDOM = document.createElement('span')
    this.#contentDOM.className = 'md-math-view-content'

    this.#dom.appendChild(this.#preview)
    this.#dom.appendChild(this.#contentDOM)

    this.#render()
  }

  get dom(): HTMLElement {
    return this.#dom
  }

  get contentDOM(): HTMLElement {
    return this.#contentDOM
  }

  update(mark: Mark): boolean {
    const next = (mark.attrs as MdMathAttrs).formula
    if (next !== this.#formula) {
      this.#formula = next
      this.#render()
    }
    return true
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    return !this.#contentDOM.contains(mutation.target)
  }

  #render(): void {
    const formula = this.#formula
    void loadKaTeX().then((katex) => {
      // A newer formula may have rendered while the module loaded.
      if (formula !== this.#formula) return
      // MathML output renders natively in every current browser, so no KaTeX
      // stylesheet or fonts are required.
      katex.render(formula, this.#preview, { throwOnError: false, output: 'mathml' })
    })
  }
}

/** Inline math rendering: a KaTeX preview on the `mdMath` mark. */
export function defineMath(): PlainExtension {
  return defineMarkView({
    name: 'mdMath' satisfies MarkName,
    constructor: (mark, view) => new MathMarkView(mark, view),
  }) as PlainExtension
}
