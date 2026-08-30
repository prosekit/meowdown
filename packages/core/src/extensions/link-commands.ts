import { getAutolinkHref } from '@meowdown/markdown'
import {
  defineCommands,
  defineKeymap,
  isTextSelection,
  type Extension,
  type PlainExtension,
} from '@prosekit/core'
import type { Command, EditorState } from '@prosekit/pm/state'
import { TextSelection } from '@prosekit/pm/state'

import type { PositionRange } from '../utils/range.ts'

import { getLinkUnitAt, type LinkUnit } from './get-link-unit-at.ts'
import { hasSyntaxMark } from './inline-runs.ts'
import { trimRange } from './inline-toggle.ts'
import { formatMagicComment } from './magic-comment.ts'

export interface LinkAttrs {
  href?: string
  title?: string
  text?: string
}

/**
 * Normalize a typed URL with the existing autolink logic, else keep it verbatim.
 */
export function normalizeHref(raw: string): string {
  const value = raw.trim()
  return value ? (getAutolinkHref(value) ?? value) : ''
}

/**
 * The `( ... )` body for a link: the href plus an optional CommonMark title.
 */
function destText(href: string, title: string): string {
  const quoted = title ? ` "${title.replaceAll(/(["\\])/g, String.raw`\$1`)}"` : ''
  return href + quoted
}

/**
 * Escape a plain-text label so it cannot pick up inline semantics: the
 * CommonMark delimiters plus meowdown's `==highlight==`, `$math$`, and `#tag`.
 */
function linkLabelText(text: string): string {
  return text.replaceAll(/([&<\\[\]_*`~=$#])/g, String.raw`\$1`)
}

/**
 * Get a range's plain visible text, skipping hidden syntax runs.
 */
function getVisibleText(state: EditorState, range: PositionRange): string {
  let text = ''
  state.doc.nodesBetween(range.from, range.to, (node, pos) => {
    if (!node.isText || !node.text || hasSyntaxMark(node.marks)) return
    const from = Math.max(range.from, pos) - pos
    const to = Math.min(range.to, pos + node.nodeSize) - pos
    text += node.text.slice(from, to)
  })
  return text
}

/**
 * Get a link's plain visible text.
 */
export function getLinkText(link: LinkUnit): string {
  return getVisibleText(link.state, link.text)
}

/**
 * Whether plain visible link text names the same destination as the link.
 */
export function isLinkTextForHref(text: string, href: string): boolean {
  const value = text.trim()
  return value === href || getAutolinkHref(value) === href
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

export interface InsertLinkOptions {
  href?: string
  title?: string
  text?: string
  wrapText?: boolean
}

export function insertLink({
  href,
  title,
  text,
  wrapText = true,
}: InsertLinkOptions = {}): Command {
  return (state, dispatch) => {
    const range = getWrapRange(state)
    if (!range) return false
    if (dispatch) {
      const { from, to } = range
      const tr = state.tr
      const dest = destText(normalizeHref(href ?? ''), title ?? '')
      let linkTo: number
      // A label matching the selection's visible text wraps the original
      // source instead, keeping any authored inline Markdown intact.
      if (text !== undefined && text !== getVisibleText(state, range)) {
        const markdown = `[${linkLabelText(text)}](${dest})`
        tr.insertText(markdown, from, to)
        linkTo = from + markdown.length
      } else {
        const close = `](${dest})`
        tr.insertText(close, to).insertText('[', from)
        linkTo = to + 1 + close.length
      }
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

/**
 * Rewrite a mutable link. Autolinks are promoted to inline Markdown when
 * their visible text or destination changes.
 */
export function updateLink(attrs: LinkAttrs): Command {
  return (state, dispatch) => {
    const link = getLinkUnitAt(state, state.selection.from)
    if (!link || link.form === 'reference') return false

    const href = normalizeHref(attrs.href ?? link.href)
    const title = attrs.title ?? link.title
    const text = attrs.text ?? getLinkText(link)
    const replacingUnit = attrs.text !== undefined || link.form !== 'inline'

    if (dispatch) {
      const transaction = replacingUnit
        ? state.tr.insertText(
            `[${linkLabelText(text)}](${destText(href, title)})`,
            link.unit.from,
            link.unit.to,
          )
        : state.tr.insertText(destText(href, title), link.dest.from, link.dest.to)
      dispatch(transaction.scrollIntoView())
    }
    return true
  }
}

/**
 * Unwrap the link at the caret: keep the label text, drop the syntax.
 */
export function removeLink(): Command {
  return (state, dispatch) => {
    const link = getLinkUnitAt(state, state.selection.from)
    if (!link || link.form === 'reference' || link.form === 'noLink') return false
    if (dispatch) {
      const text = getLinkText(link)
      // Keep authored label Markdown intact when it cannot immediately become
      // an autolink again; otherwise keep the text verbatim and opt it out of
      // autolinking with an invisible trailing magic comment.
      const tr =
        link.form === 'inline' && !getAutolinkHref(text)
          ? state.tr.delete(link.label.to, link.unit.to).delete(link.unit.from, link.label.from)
          : state.tr.insertText(
              text + formatMagicComment({ noLink: true }),
              link.unit.from,
              link.unit.to,
            )
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}

/**
 * Delete the trailing `noLink` magic comment so the address autolinks again.
 */
export function relinkURL(): Command {
  return (state, dispatch) => {
    const link = getLinkUnitAt(state, state.selection.from)
    if (!link || link.form !== 'noLink' || link.text.to === link.unit.to) return false
    dispatch?.(state.tr.delete(link.text.to, link.unit.to).scrollIntoView())
    return true
  }
}

export function defineLinkCommands(): Extension<{
  Commands: {
    insertLink: [options?: InsertLinkOptions]
    updateLink: [attrs: LinkAttrs]
    removeLink: []
    relinkURL: []
  }
}> {
  return defineCommands({ insertLink, updateLink, removeLink, relinkURL })
}

export interface LinkEditOptions {
  from: number
  to: number
  link: LinkUnit | undefined
  text: string
}

export type LinkEditHandler = (options: LinkEditOptions) => void

function openLinkEdit(onLinkEdit: LinkEditHandler): Command {
  return (state, dispatch, view) => {
    const link = getLinkUnitAt(state, state.selection.from)

    if (link) {
      if (link.form === 'reference') return false
      if (dispatch && view) {
        const {
          unit: { from, to },
        } = link
        dispatch(state.tr.setSelection(TextSelection.create(state.doc, from, to)).scrollIntoView())
        view.focus()
        onLinkEdit({ from, to, link, text: getLinkText(link) })
      }
      return true
    }

    const wrapRange = getWrapRange(state)
    if (wrapRange) {
      if (dispatch && view) {
        const { from, to } = wrapRange
        dispatch(state.tr.setSelection(TextSelection.create(state.doc, from, to)).scrollIntoView())
        view.focus()
        onLinkEdit({
          from,
          to,
          link: undefined,
          text: getVisibleText(state, wrapRange),
        })
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
