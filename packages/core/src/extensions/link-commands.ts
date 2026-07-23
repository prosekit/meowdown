import { getAutolinkHref } from '@meowdown/markdown'
import { defineCommands, defineKeymap, isTextSelection, type PlainExtension } from '@prosekit/core'
import type { Command, EditorState } from '@prosekit/pm/state'
import { TextSelection } from '@prosekit/pm/state'

import type { PositionRange } from '../utils/range.ts'

import { getLinkUnitAt, type LinkUnit } from './get-link-unit-at.ts'
import { trimRange } from './inline-toggle.ts'

export interface LinkAttrs {
  href?: string
  title?: string
}

/** Normalize a typed URL with the existing autolink logic, else keep it verbatim. */
function normalizeHref(raw: string): string {
  const value = raw.trim()
  return value ? (getAutolinkHref(value) ?? value) : ''
}

/** The `( ... )` body for a link: the href plus an optional CommonMark title. */
function destText(href: string, title: string): string {
  const quoted = title ? ` "${title.replaceAll(/(["\\])/g, String.raw`\$1`)}"` : ''
  return href + quoted
}

/**
 * The range a new link would wrap: the current selection when it is a
 * non-empty text selection inside a single non-code textblock, trimmed of
 * surrounding whitespace. `undefined` when there is nothing to wrap.
 */
function getWrapRange(state: EditorState): undefined | PositionRange {
  const { selection } = state
  const { $from, $to, empty } = selection
  if (empty || !$from.sameParent($to) || !isTextSelection(selection)) {
    return
  }
  const block = $from.parent
  if (!block.isTextblock || block.type.spec.code) {
    return
  }

  const base = $from.start()
  const [from, to] = trimRange(block.textContent, $from.parentOffset, $to.parentOffset)
  if (from >= to) {
    return
  }

  return {
    from: base + from,
    to: base + to,
  }
}

export function insertLink({
  href,
  title,
  wrapText = true,
}: {
  href?: string
  title?: string
  wrapText?: boolean
} = {}): Command {
  return (state, dispatch) => {
    const range = getWrapRange(state)
    if (!range) return false
    if (dispatch) {
      const { from, to } = range
      const tr = state.tr
      const dest = destText(normalizeHref(href ?? ''), title ?? '')
      const close = `](${dest})`
      tr.insertText(close, to).insertText('[', from)
      // The position after the closing `)`
      const linkTo = to + 1 + close.length
      tr.setSelection(
        wrapText
          ? TextSelection.create(tr.doc, from, linkTo)
          : TextSelection.create(tr.doc, linkTo),
      )
      tr.scrollIntoView()
      dispatch(tr)
    }
    return true
  }
}

/** Rewrite the `( ... )` of the link at the caret/selection. */
export function updateLink(attrs: LinkAttrs): Command {
  return (state, dispatch) => {
    const link = getLinkUnitAt(state, state.selection.from)
    if (!link?.dest) return false
    const dest = destText(normalizeHref(attrs.href ?? link.href), attrs.title ?? link.title)
    if (dispatch) {
      dispatch(state.tr.insertText(dest, link.dest.from, link.dest.to).scrollIntoView())
    }
    return true
  }
}

/** Unwrap the link at the caret: keep the label text, drop the syntax. */
export function removeLink(): Command {
  return (state, dispatch) => {
    const link = getLinkUnitAt(state, state.selection.from)
    if (!link?.label) return false // autolinks cannot be text-unwrapped
    if (dispatch) {
      // delete the tail `](url "title")` first, then the leading `[`
      const tr = state.tr
        .delete(link.label.to, link.unit.to)
        .delete(link.unit.from, link.label.from)
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}

export function defineLinkCommands() {
  return defineCommands({ insertLink, updateLink, removeLink })
}

export interface LinkEditOptions {
  from: number
  to: number
  link: LinkUnit | undefined
}

export type LinkEditHandler = (options: LinkEditOptions) => void

function openLinkEdit(onLinkEdit: LinkEditHandler): Command {
  return (state, dispatch, view) => {
    const link = getLinkUnitAt(state, state.selection.from)

    if (link) {
      if (link.label == null || link.dest == null) return false
      if (dispatch && view) {
        const {
          unit: { from, to },
        } = link
        dispatch(state.tr.setSelection(TextSelection.create(state.doc, from, to)).scrollIntoView())
        view.focus()
        onLinkEdit({ from, to, link })
      }
      return true
    }

    const wrapRange = getWrapRange(state)
    if (wrapRange) {
      if (dispatch && view) {
        const { from, to } = wrapRange
        dispatch(state.tr.setSelection(TextSelection.create(state.doc, from, to)).scrollIntoView())
        view.focus()
        onLinkEdit({ from, to, link: undefined })
      }
      return true
    }

    return false
  }
}

export function defineLinkEditKeymap(onLinkEdit: LinkEditHandler): PlainExtension {
  return defineKeymap({
    'Mod-k': openLinkEdit(onLinkEdit),
  })
}
