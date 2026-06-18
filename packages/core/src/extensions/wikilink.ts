import { defineMarkView, union, type PlainExtension } from '@prosekit/core'
import type { MarkViewConstructor } from '@prosekit/pm/view'

import { defineAtomicMarkNavigation } from './atomic-mark-navigation.ts'
import type { MdWikilinkViewAttrs } from './inline-marks.ts'
import type { MarkName } from './mark-names.ts'

/**
 * Render `mdWikilinkView` (anchored on the wikilink's final character) as the
 * non-editable label: the anchor char stays inside `contentDOM`, and the label
 * is a `contentEditable="false"` sibling. Mark-mode hides the surrounding
 * `mdWikilinkSource`, so what remains visible is the label, in place of the raw
 * `[[target]]`/`[[target|alias]]`.
 */
function createWikilinkMarkView(): MarkViewConstructor {
  return (mark) => {
    const attrs = mark.attrs as MdWikilinkViewAttrs

    const dom = document.createElement('span')
    dom.className = 'md-wikilink-view'
    const contentDOM = document.createElement('span')
    dom.appendChild(contentDOM)

    const label = document.createElement('span')
    label.className = 'md-wikilink-label'
    label.contentEditable = 'false'
    label.dataset.testid = 'wikilink'
    label.textContent = attrs.display || attrs.target
    dom.appendChild(label)

    return {
      dom,
      contentDOM,
      ignoreMutation: (mutation) => !contentDOM.contains(mutation.target),
    }
  }
}

/**
 * Render `[[target]]`/`[[target|alias]]` as an immutable inline label (a mark
 * view) and make it a single caret stop in hide mode: arrowing onto it selects
 * the whole source, and Backspace/Delete remove it as a unit.
 */
export function defineWikilink(): PlainExtension {
  return union(
    defineMarkView({
      name: 'mdWikilinkView' satisfies MarkName,
      constructor: createWikilinkMarkView(),
    }),
    defineAtomicMarkNavigation({
      markNames: ['mdWikilinkSource' satisfies MarkName],
      selectedClass: 'md-wikilink-selected',
    }),
  )
}
