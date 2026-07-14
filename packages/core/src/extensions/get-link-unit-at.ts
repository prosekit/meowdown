import type { EditorState } from '@prosekit/pm/state'

import type { PositionRange } from '../utils/range.ts'

import { getMarkRangeAt } from './get-mark-range-at.ts'
import type { MdLinkTextAttrs, MdPackAttrs } from './inline-marks.ts'
import type { MarkName } from './mark-names.ts'

export interface LinkUnit {
  /** Whole `[text](url "title")` (or autolink) range */
  unit: PositionRange

  /**
   * The visible text of the link: the `[ ]` interior for a full link, the URL
   * between `< >` for an angle autolink, the whole unit for a bare autolink.
   * Popovers anchor on it; the unit's edges can sit inside hidden syntax,
   * whose collapsed glyphs measure at bogus coordinates.
   */
  text: PositionRange

  /** Interior of `[ ]`. Absent for an autolink. */
  label?: PositionRange

  /** Interior of `( )`. What `updateLink` rewrites. Absent for an autolink. */
  dest?: PositionRange

  /** The link URL. Could be an empty string. */
  href: string

  /** The link title, unquoted. Could be an empty string. */
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
    if (node.isText && node.marks.some((mark) => mark.type.name === markName)) {
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
  const linkText = getMarkRangeAt(state, pos, 'mdLinkText')
  // A position inside nested units carries one `mdPack` per level and the mark
  // set's order follows edit history, so select the pack by `key` instead of
  // taking whichever sits first. `[text](url)` and `<url>` carry a pack over
  // the whole unit; bare/www autolinks carry only `mdLinkText`, so fall back to
  // that run.
  const pack =
    getMarkRangeAt(state, pos, 'mdPack', { key: 'link' } satisfies Partial<MdPackAttrs>) ??
    getMarkRangeAt(state, pos, 'mdPack', { key: 'autolink' } satisfies Partial<MdPackAttrs>)
  const unit = pack ?? linkText
  if (!unit) return

  const packAttrs = pack?.mark.attrs as MdPackAttrs | undefined
  const linkTextAttrs = linkText?.mark.attrs as MdLinkTextAttrs | undefined
  const href = linkTextAttrs?.href ?? ''

  // Only a real `[text](dest)` has an editable label/dest.
  // Autolinks just resolve an href. A bare autolink is its own visible text;
  // an angle autolink's visible text is the URL run between the hidden `<`/`>`
  // (the run lookup misses when `pos` sits on a bracket, so fall back to the
  // grammar's fixed one-character brackets).
  if (!pack || packAttrs?.key !== 'link') {
    const unitRange = { from: unit.from, to: unit.to }
    const text =
      packAttrs?.key === 'autolink'
        ? (lastMarkRunIn(state, unitRange, 'mdLinkText') ?? {
            from: unit.from + 1,
            to: unit.to - 1,
          })
        : unitRange
    return {
      unit: unitRange,
      text,
      href,
      title: '',
    }
  }

  if (packAttrs.data.reference === true) {
    // The parser's mdLinkText run includes the opening `[` but ends before
    // the label's closing `]`; trim that one source character for the visible
    // anchor range. Clicks normally originate inside this run.
    const text =
      linkText === undefined
        ? { from: unit.from, to: unit.to }
        : { from: linkText.from + 1, to: linkText.to }
    return {
      unit: { from: unit.from, to: unit.to },
      text,
      href: packAttrs.data.href,
      title: packAttrs.data.title,
    }
  }

  // `[` at unit.from, `)` at unit.to - 1. With a url, `]` sits two chars before
  // the url start (`](`); with an empty `()`, `]` is two chars before the `)`.
  const uri = lastMarkRunIn(state, unit, 'mdLinkUri')
  const closeBracket = uri ? uri.from - 2 : unit.to - 3
  const destFrom = uri ? uri.from : unit.to - 1

  const label = { from: unit.from + 1, to: closeBracket }
  return {
    unit: { from: unit.from, to: unit.to },
    text: label,
    label,
    dest: { from: destFrom, to: unit.to - 1 },
    href: packAttrs.data.href,
    title: packAttrs.data.title,
  }
}
