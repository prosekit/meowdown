import type { Mark, ProseMirrorNode } from '@prosekit/pm/model'

import type {
  MdFileAttrs,
  MdImageAttrs,
  MdMathAttrs,
  MdWikilinkAttrs,
} from '../extensions/inline-marks.ts'
import { groupInlineRuns, hasSyntaxMark } from '../extensions/inline-runs.ts'
import type { MarkName } from '../extensions/mark-names.ts'

function getAtomDisplayText(atom: Mark): string {
  switch (atom.type.name as MarkName) {
    case 'mdWikilink': {
      const attrs = atom.attrs as MdWikilinkAttrs
      return attrs.display || attrs.target
    }
    case 'mdImage':
      return (atom.attrs as MdImageAttrs).alt
    case 'mdFile':
      return (atom.attrs as MdFileAttrs).name
    case 'mdMath':
      return (atom.attrs as MdMathAttrs).formula
    default:
      return ''
  }
}

/**
 * The textblock as its live-preview marks display it: syntax runs are
 * omitted and each atom unit is replaced by its display text.
 */
export function getTextblockDisplayText(textblock: ProseMirrorNode): string {
  let output = ''
  for (const run of groupInlineRuns(textblock)) {
    if (run.atom != null) {
      output += getAtomDisplayText(run.atom)
      continue
    }
    for (const child of run.children) {
      if (!hasSyntaxMark(child.marks)) output += child.text ?? ''
    }
  }
  return output
}
