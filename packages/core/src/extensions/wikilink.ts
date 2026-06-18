import { defineMarkView, type PlainExtension } from '@prosekit/core'
import type { MarkViewConstructor } from '@prosekit/pm/view'

import type { MdWikilinkViewAttrs } from './inline-marks.ts'
import type { MarkName } from './mark-names.ts'

export interface ParsedWikilink {
  target: string
  display: string
}

/** Splits `[[target]]`/`[[target|alias]]` into its target and display label (the alias, or empty). */
export function parseWikilink(text: string): ParsedWikilink {
  const inner = text.replace(/^\[\[/, '').replace(/\]\]$/, '')
  const pipe = inner.indexOf('|')
  if (pipe < 0) return { target: inner.trim(), display: '' }
  return { target: inner.slice(0, pipe).trim(), display: inner.slice(pipe + 1).trim() }
}

/**
 * Render `mdWikilinkView` (anchored on the wikilink's final character) as the
 * non-editable label: the anchor char stays inside `contentDOM`, and the label
 * is a `contentEditable="false"` sibling. Mark-mode hides the surrounding
 * `mdWikilinkSource`, so what remains visible is the label, in place of the raw
 * `[[target]]`/`[[target|alias]]`.
 *
 * The label is appended before `contentDOM` so the anchor char (the wikilink's
 * trailing edge) sits after it. A collapsed caret placed just after the wikilink
 * then lands in `contentDOM`, which `style.css` keeps in the layout (zero width)
 * rather than `display:none`, so the caret rests after the label and typing
 * continues after the wikilink instead of being trapped before it.
 */
function createWikilinkMarkView(): MarkViewConstructor {
  return (mark) => {
    const attrs = mark.attrs as MdWikilinkViewAttrs

    const dom = document.createElement('span')
    dom.className = 'md-wikilink-view'

    const label = document.createElement('span')
    label.className = 'md-wikilink-label'
    label.contentEditable = 'false'
    label.dataset.testid = 'wikilink'
    label.textContent = attrs.display || attrs.target
    dom.appendChild(label)

    const contentDOM = document.createElement('span')
    contentDOM.className = 'md-wikilink-view-content'
    dom.appendChild(contentDOM)

    return {
      dom,
      contentDOM,
      ignoreMutation: (mutation) => !contentDOM.contains(mutation.target),
    }
  }
}

/**
 * Render `[[target]]`/`[[target|alias]]` as an immutable inline label (a mark
 * view) standing in for the raw source. The single-caret-stop behavior in hide
 * mode comes from the shared `defineAtomicMarkNavigation` in the editor
 * extension, which treats `mdWikilinkSource` (and `mdImageSource`) as one unit.
 */
export function defineWikilink(): PlainExtension {
  return defineMarkView({
    name: 'mdWikilinkView' satisfies MarkName,
    constructor: createWikilinkMarkView(),
  }) as PlainExtension
}
