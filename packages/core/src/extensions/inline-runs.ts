import type { Mark, ProseMirrorNode } from '@prosekit/pm/model'

import { ATOM_MARK_NAMES, SYNTAX_MARK_NAMES } from './mark-names.ts'

function findAtomMark(marks: readonly Mark[]): Mark | undefined {
  return marks.find((mark) => ATOM_MARK_NAMES.has(mark.type.name))
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
 * text nodes share one mark instance (the inline parser creates each unit
 * mark once), so instance identity splits adjacent same-attrs units.
 */
export function groupInlineRuns(textblock: ProseMirrorNode): InlineRun[] {
  const runs: InlineRun[] = []
  textblock.forEach((child) => {
    if (!child.isText || !child.text) return
    const atom = findAtomMark(child.marks)
    const last = runs.at(-1)
    if (atom != null && last != null && last.atom === atom) {
      last.text += child.text
      last.children.push(child)
      return
    }
    runs.push({ atom, text: child.text, children: [child] })
  })
  return runs
}
