import type { EditorState } from '@prosekit/pm/state'

import type { PositionRange } from '../utils/range.ts'

import type { MdPackAttrs } from './inline-marks.ts'
import { isMarkOfType, type MarkName } from './mark-names.ts'
import { getMarkRangeAt } from './mark-range.ts'

export interface LinkUnit {
  /**
   * Whole inline link, reference link, or autolink range.
   */
  unit: PositionRange

  /**
   * The visible text of the link: the `[ ]` interior for a full link, the URL
   * between `< >` for an angle autolink, the whole unit for a bare autolink.
   * Popovers anchor on it; the unit's edges can sit inside hidden syntax,
   * whose collapsed glyphs measure at bogus coordinates.
   */
  text: PositionRange

  /**
   * Interior of `[ ]`. Absent for an autolink.
   */
  label?: PositionRange

  /**
   * Interior of `( )`. What `updateLink` rewrites. Absent for an autolink.
   */
  dest?: PositionRange

  /**
   * The link URL. Could be an empty string.
   */
  href: string

  /**
   * The link title, unquoted. Could be an empty string.
   */
  title: string
}

/**
 * The last text run carrying `markName` inside `range`. "Last" so a linked
 * image's inner url/title (which comes first) never shadows the link's own.
 */
function lastMarkRunIn(
  state: EditorState,
  range: PositionRange,
  markName: MarkName,
): PositionRange | undefined {
  let found: PositionRange | undefined
  state.doc.nodesBetween(range.from, range.to, (node, nodePos) => {
    if (node.isText && node.marks.some((mark) => isMarkOfType(mark, markName))) {
      found = {
        from: Math.max(nodePos, range.from),
        to: Math.min(nodePos + node.nodeSize, range.to),
      }
    }
    return true
  })
  return found
}

/**
 * The link covering `pos`, with its sub-ranges (`label`, `dest`) and parsed
 * `href`/`title`. The single query the commands and the hover/click handlers
 * share, replacing the old `findLinkAt`.
 *
 * Derived entirely from the marks already on the document (no re-parse): the
 * `mdPack` unit gives the shape and carries the `href`/`title` in its `data`, and
 * the `mdLinkUri` run locates the `( )` body.
 */
export function getLinkUnitAt(state: EditorState, pos: number): LinkUnit | undefined {
  // A position inside nested units carries one `mdPack` per level, so select
  // the pack by `key`: a link inside `**bold**` must find its own pack, not
  // the outer unit's.
  const unit = getMarkRangeAt(state, pos, 'mdPack', { key: 'link' } satisfies Partial<MdPackAttrs>)
  if (!unit) return

  const { data } = unit.mark.attrs as Extract<MdPackAttrs, { key: 'link' }>
  const unitRange = { from: unit.from, to: unit.to }

  switch (data.form) {
    // A bare autolink is its own visible text.
    case 'bare':
      return { unit: unitRange, text: unitRange, href: data.href, title: '' }

    // An angle autolink's visible text is its interior: the grammar fixes the
    // hidden `<`/`>` at one character each.
    case 'angle': {
      const text = { from: unit.from + 1, to: unit.to - 1 }
      return { unit: unitRange, text, href: data.href, title: '' }
    }

    // A reference link's href/title live in its definition, so only its
    // visible label is editable in place.
    case 'reference': {
      const linkText = getMarkRangeAt(state, pos, 'mdLinkText')
      const text = linkText == null ? unitRange : { from: linkText.from + 1, to: linkText.to }
      return { unit: unitRange, text, href: data.href, title: data.title }
    }

    // Only a real `[text](dest)` has an editable label/dest.
    case 'inline': {
      // `[` at unit.from, `)` at unit.to - 1. With a url, `]` sits two chars
      // before the url start (`](`); with an empty `()`, `]` is two chars
      // before the `)`.
      const uri = lastMarkRunIn(state, unitRange, 'mdLinkUri')
      const closeBracket = uri ? uri.from - 2 : unit.to - 3
      const destFrom = uri ? uri.from : unit.to - 1

      const label = { from: unit.from + 1, to: closeBracket }
      return {
        unit: unitRange,
        text: label,
        label,
        dest: { from: destFrom, to: unit.to - 1 },
        href: data.href,
        title: data.title,
      }
    }
  }
}
