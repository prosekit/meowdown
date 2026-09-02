import { defineMarkView, type PlainExtension } from '@prosekit/core'
import type { MarkViewConstructor } from '@prosekit/pm/view'

import type { MdWikilinkAttrs } from './inline-marks.ts'
import type { MarkName } from './mark-names.ts'

export interface ParsedWikilink {
  target: string
  display: string
}

/**
 * Splits `[[target]]`/`[[target|alias]]` into its target and display label (the alias, or empty).
 */
export function parseWikilink(text: string): ParsedWikilink {
  const inner = text.replace(/^\[\[/, '').replace(/\]\]$/, '')
  const pipe = inner.indexOf('|')
  if (pipe < 0) return { target: inner.trim(), display: '' }
  return { target: inner.slice(0, pipe).trim(), display: inner.slice(pipe + 1).trim() }
}

/**
 * A resolved wikilink label.
 */
export interface WikilinkResolution {
  /**
   * Label shown in place of the source. Defaults to the alias, else the target.
   */
  display?: string
}

/**
 * Resolves the label of one `[[target]]`/`[[target|alias]]`. Only the label
 * changes: the target, click payloads, and the Markdown source stay as
 * written. Return `undefined` to keep the default label. The resolver
 * participates in the parse cache, so it must be pure: the same link must
 * always return the same result.
 */
export type WikilinkResolver = (link: ParsedWikilink) => WikilinkResolution | undefined

/**
 * Host options for wikilink parsing.
 */
export interface WikilinkOptions {
  resolveWikilink?: WikilinkResolver
}

/**
 * Render `mdWikilink` as a non-editable label standing in for the raw source.
 * The source stays in `contentDOM` after the label, hidden by `style.css`
 * (`.md-atom-view-content`); the whole wikilink is one caret stop owned by
 * `defineAtomMarkNavigation`.
 */
function createWikilinkMarkView(): MarkViewConstructor {
  return (mark) => {
    const attrs = mark.attrs as MdWikilinkAttrs

    const dom = document.createElement('span')
    dom.className = 'md-wikilink-view md-atom-view'

    const preview = document.createElement('span')
    preview.className = 'md-wikilink-view-preview md-atom-view-preview'
    preview.contentEditable = 'false'
    preview.dataset.testid = 'wikilink'
    dom.appendChild(preview)

    const label = document.createElement('span')
    label.className = 'md-wikilink-view-label'
    label.contentEditable = 'false'
    label.textContent = attrs.display || attrs.target
    preview.appendChild(label)

    const contentDOM = document.createElement('span')
    contentDOM.className = 'md-wikilink-view-content md-atom-view-content'
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
 * treats `mdWikilink` (and `mdImage`) as one unit.
 */
export function defineWikilink(): PlainExtension {
  return defineMarkView({
    name: 'mdWikilink' satisfies MarkName,
    constructor: createWikilinkMarkView(),
  }) as PlainExtension
}
