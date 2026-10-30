import { matchEmbed } from '@meowdown/markdown'
import { closeHistory } from '@prosekit/pm/history'
import type { Command, EditorState } from '@prosekit/pm/state'
import { TextSelection } from '@prosekit/pm/state'
import { decodeString } from 'micromark-util-decode-string'

import { getLinkUnitAt } from './get-link-unit-at.ts'
import type { MdImageAttrs } from './inline-marks.ts'
import { getLinkText } from './link-commands.ts'
import { getMarkRangeAt } from './mark-range.ts'

export type LinkPresentation = 'link' | 'embed'

export interface PresentedLink {
  readonly from: number
  readonly to: number
  readonly href: string
  readonly text: string
  readonly title: string
  readonly presentation: LinkPresentation
}

/**
 * Supported web links and embeds touched by the current selection, excluding code.
 */
export function getPresentedLinks(state: EditorState): PresentedLink[] {
  const found = new Map<number, PresentedLink>()
  const { from, to, empty } = state.selection
  const visit = (position: number): void => {
    const image = getMarkRangeAt(state, position, 'mdImage')
    if (image) {
      const { src, alt, title } = image.mark.attrs as MdImageAttrs
      if (matchEmbed(src)) {
        found.set(image.from, {
          from: image.from,
          to: image.to,
          href: src,
          text: alt,
          title,
          presentation: 'embed',
        })
      }
      return
    }
    const link = getLinkUnitAt(state, position)
    if (link && matchEmbed(link.href)) {
      found.set(link.unit.from, {
        ...link.unit,
        href: link.href,
        text: getLinkText(link),
        title: link.title,
        presentation: 'link',
      })
    }
  }
  if (empty) visit(from)
  else {
    state.doc.nodesBetween(from, to, (node, position) => {
      if (node.isText) visit(Math.max(position, from))
    })
  }
  return [...found.values()].sort((left, right) => left.from - right.from)
}

/**
 * Switch selected supported links between ordinary Markdown links and embeds.
 * The change is local and undoable; it never resolves a URL or performs I/O.
 */
export function setLinkPresentation(presentation: LinkPresentation): Command {
  return (state, dispatch) => {
    const links = getPresentedLinks(state).filter((link) => link.presentation !== presentation)
    if (links.length === 0) return false
    if (dispatch) {
      const transaction = closeHistory(state.tr)
      for (const link of links.toReversed()) {
        const destination = link.href.replaceAll('(', '%28').replaceAll(')', '%29')
        const label = decodeString(link.text || link.href).replaceAll(
          /([&<\\[\]_*`~=$#])/g,
          String.raw`\$1`,
        )
        const title = link.title ? ` "${link.title.replaceAll(/(["\\])/g, String.raw`\$1`)}"` : ''
        const markdown =
          presentation === 'embed'
            ? `![${label}](${destination}${title})`
            : `[${label}](${destination}${title})`
        transaction.insertText(markdown, link.from, link.to)
      }
      const start = transaction.mapping.map(state.selection.from, state.selection.empty ? 1 : -1)
      const end = state.selection.empty ? start : transaction.mapping.map(state.selection.to, 1)
      transaction.setSelection(
        TextSelection.between(transaction.doc.resolve(start), transaction.doc.resolve(end)),
      )
      dispatch(transaction.scrollIntoView())
    }
    return true
  }
}
