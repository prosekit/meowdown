import type { Mark, ProseMirrorNode } from '@prosekit/pm/model'

import { ATOM_MARK_NAMES, isMarkOfType, SYNTAX_MARK_NAMES } from './mark-names.ts'

function findAtomMark(marks: readonly Mark[]): Mark | undefined {
  return marks.find((mark) => ATOM_MARK_NAMES.has(mark.type.name))
}

// The unit's own pack: the innermost `mdPack` (outer entries belong to
// enclosing units, and nothing nests inside an atom unit).
function findOwnPackMark(marks: readonly Mark[]): Mark | undefined {
  return marks.findLast((mark) => isMarkOfType(mark, 'mdPack'))
}

export function hasSyntaxMark(marks: readonly Mark[]): boolean {
  return marks.some((mark) => SYNTAX_MARK_NAMES.has(mark.type.name))
}

export interface InlineRun {
  atom: Mark | undefined
  text: string
  children: ProseMirrorNode[]
}

/**
 * Group a textblock's text nodes into atom units and plain runs. A unit's
 * text nodes carry equal packs, while an identical neighbour's pack differs
 * by `slot`, so pack equality splits adjacent same-attrs units.
 */
export function groupInlineRuns(textblock: ProseMirrorNode): InlineRun[] {
  const runs: InlineRun[] = []
  let previousPack: Mark | undefined
  textblock.forEach((child) => {
    if (!child.isText || !child.text) {
      previousPack = undefined
      return
    }
    const atom = findAtomMark(child.marks)
    const pack = findOwnPackMark(child.marks)
    const last = runs.at(-1)
    const continuesUnit =
      atom != null &&
      last?.atom != null &&
      pack != null &&
      previousPack != null &&
      pack.eq(previousPack)
    previousPack = pack
    if (continuesUnit && last != null) {
      last.text += child.text
      last.children.push(child)
      return
    }
    runs.push({ atom, text: child.text, children: [child] })
  })
  return runs
}
