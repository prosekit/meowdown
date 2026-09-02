import { defineMarkView, type PlainExtension } from '@prosekit/core'
import type { MarkViewConstructor } from '@prosekit/pm/view'

import type { MdWikilinkAttrs } from './inline-marks.ts'
import type { MarkName } from './mark-names.ts'

/**
 * What {@link WikilinkResolver} sees for one `[[...]]` wikilink.
 */
export interface WikilinkPayload {
  /**
   * The text between the brackets, trimmed. Meowdown reads no syntax inside
   * it: an alias form such as `[[target|alias]]` arrives here whole.
   */
  target: string
}

/**
 * A resolved wikilink.
 */
export interface WikilinkResolution {
  /**
   * Target passed to click and hover handlers. Defaults to the bracketed text.
   */
  target?: string
  /**
   * Label shown in place of the source. Defaults to the target.
   */
  display?: string
}

/**
 * Resolves one `[[...]]` wikilink into the target its handlers receive and
 * the label its chip shows; the Markdown source stays as written. Return
 * `undefined` to use the bracketed text as both. The resolver participates
 * in the parse cache, so it must be pure: the same payload must always
 * return the same result.
 */
export type WikilinkResolver = (link: WikilinkPayload) => WikilinkResolution | undefined

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
 * Render `[[...]]` as an immutable inline label (a mark
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
