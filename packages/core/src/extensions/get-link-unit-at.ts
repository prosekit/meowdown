import type { EditorState } from '@prosekit/pm/state'

import type { PositionRange } from '../utils/range.ts'

import { getMarkRangeAt } from './get-mark-range-at.ts'
import type { MdLinkTextAttrs, MdPackAttrs } from './inline-marks.ts'
import type { MarkName } from './mark-names.ts'

export interface LinkUnit {
  /** Whole `[text](url "title")` (or autolink) range */
  unit: PositionRange

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
  // Autolinks just resolve an href.
  if (!pack || packAttrs?.key !== 'link') {
    return {
      unit: { from: unit.from, to: unit.to },
      href,
      title: '',
    }
  }

  // `[` at unit.from, `)` at unit.to - 1. With a url, `]` sits two chars before
  // the url start (`](`); with an empty `()`, `]` is two chars before the `)`.
  const uri = lastMarkRunIn(state, unit, 'mdLinkUri')
  const closeBracket = uri ? uri.from - 2 : unit.to - 3
  const destFrom = uri ? uri.from : unit.to - 1

  return {
    unit: { from: unit.from, to: unit.to },
    label: { from: unit.from + 1, to: closeBracket },
    dest: { from: destFrom, to: unit.to - 1 },
    href: packAttrs.data.href,
    title: packAttrs.data.title,
  }
}
