import type { EditorState } from '@prosekit/pm/state'

import type { PositionRange } from '../utils/range.ts'

import type { MdPackAttrs } from './inline-marks.ts'
import { isMarkOfType, type MarkName } from './mark-names.ts'
import { getMarkRangeAt } from './mark-range.ts'

interface LinkUnitBase {
  state: EditorState

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
   * The link URL. Could be an empty string.
   */
  href: string

  /**
   * The link title, unquoted. Could be an empty string.
   */
  title: string
}

export type LinkUnit =
  | (LinkUnitBase & {
      form: 'inline'

      /**
       * Interior of `[ ]`.
       */
      label: PositionRange

      /**
       * Interior of `( )`. What `updateLink` rewrites.
       */
      dest: PositionRange
    })
  | (LinkUnitBase & {
      /**
       * A reference link or autolink resolves an href but has no editable
       * label/dest.
       */
      form: 'reference' | 'angle' | 'bare'
      label?: undefined
      dest?: undefined
    })

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
  const unit = getMarkRangeAt(state, pos, 'mdPack', (mark) => { return (mark.attrs as MdPackAttrs).key.startsWith('link-') },
  )
  if (!unit) return

  const attrs = unit.mark.attrs as Extract<MdPackAttrs, { key: `link-${string}` }>
  const unitRange = { from: unit.from, to: unit.to }

  switch (attrs.key) {
    // A bare autolink is its own visible text.
    case 'link-bare':
      return {
        state,
        form: 'bare',
        unit: unitRange,
        text: unitRange,
        href: attrs.data.href,
        title: '',
      }

    // An angle autolink's visible text is its interior: the grammar fixes the
    // hidden `<`/`>` at one character each.
    case 'link-angle': {
      const text = { from: unit.from + 1, to: unit.to - 1 }
      return { state, form: 'angle', unit: unitRange, text, href: attrs.data.href, title: '' }
    }

    // A reference link's href/title live in its definition, so only its
    // visible label is editable in place.
    case 'link-reference': {
      const linkText = getMarkRangeAt(state, pos, 'mdLinkText')
      const text = linkText == null ? unitRange : { from: linkText.from + 1, to: linkText.to }
      return {
        state,
        form: 'reference',
        unit: unitRange,
        text,
        href: attrs.data.href,
        title: attrs.data.title,
      }
    }

    // Only a real `[text](dest)` has an editable label/dest.
    case 'link-inline': {
      // `[` at unit.from, `)` at unit.to - 1. With a url, `]` sits two chars
      // before the url start (`](`); with an empty `()`, `]` is two chars
      // before the `)`.
      const uri = lastMarkRunIn(state, unitRange, 'mdLinkUri')
      const closeBracket = uri ? uri.from - 2 : unit.to - 3
      const destFrom = uri ? uri.from : unit.to - 1

      const label = { from: unit.from + 1, to: closeBracket }
      return {
        state,
        form: 'inline',
        unit: unitRange,
        text: label,
        label,
        dest: { from: destFrom, to: unit.to - 1 },
        href: attrs.data.href,
        title: attrs.data.title,
      }
    }
  }
}
