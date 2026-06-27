import { defineMarkView, type PlainExtension } from '@prosekit/core'
import type { MarkViewConstructor } from '@prosekit/pm/view'

import type { MdWikilinkV2Attrs } from './inline-marks.ts'
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
 * Render `mdWikilinkV2` as a non-editable label standing in for the raw source.
 * The source stays in `contentDOM`, after the label, kept in the layout (not
 * `display:none`) by `style.css` so a caret just after the wikilink lands there
 * and typing continues after it, never trapped before it.
 */
function createWikilinkMarkView(): MarkViewConstructor {
  return (mark) => {
    const attrs = mark.attrs as MdWikilinkV2Attrs

    const dom = document.createElement('span')
    dom.className = 'md-wikilink-view-v2 md-atom-view'

    const preview = document.createElement('span')
    preview.className = 'md-wikilink-view-preview-v2 md-atom-view-preview'
    preview.contentEditable = 'false'
    preview.dataset.testid = 'wikilink'
    dom.appendChild(preview)

    const label = document.createElement('span')
    label.className = 'md-wikilink-view-label-v2'
    label.contentEditable = 'false'
    label.textContent = attrs.display || attrs.target
    preview.appendChild(label)

    const contentDOM = document.createElement('span')
    contentDOM.className = 'md-wikilink-view-content-v2 md-atom-view-content'
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
 * view) standing in for the raw source. The single-caret-stop behavior comes
 * from the shared `defineAtomMarkNavigation` in the editor extension, which
 * treats `mdWikilinkV2` (and `mdImageV2`) as one unit.
 */
export function defineWikilink(): PlainExtension {
  return defineMarkView({
    name: 'mdWikilinkV2' satisfies MarkName,
    constructor: createWikilinkMarkView(),
  }) as PlainExtension
}
