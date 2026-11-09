import { matchEmbed, type EmbedKind } from '@meowdown/markdown'
import { isElementLike } from '@ocavue/utils'
import { defineKeymap, definePlugin, union, type PlainExtension } from '@prosekit/core'
import {
  Plugin,
  PluginKey,
  TextSelection,
  type Command,
  type EditorState,
} from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

import type { MdImageAttrs } from './inline-marks.ts'
import { stripMagicComment } from './magic-comment.ts'
import { getMarkRangeAt } from './mark-range.ts'

const embedMenuKey = new PluginKey('meowdown-embed-menu')

/**
 * The class of the menu button that an image, X post, or YouTube card shows
 * in the editor.
 */
export const EMBED_MENU_BUTTON_CLASS = 'md-embed-menu-button'

/**
 * An image, X post, or YouTube card in the document: its `![](src)` or
 * `![[target]]` source, including any trailing magic comment, spans `from` to
 * `to`. `src` is the image or post URL.
 */
export interface EmbedTarget {
  kind: EmbedKind | 'image'
  src: string
  alt: string
  from: number
  to: number
}

// FIXME: question: Is there any case that we use "EmbedTarget" but we do not use "EmbedHit" ? If the answer is yes, use a comment to explain why these two interfaces are different. If the answer is no, just use one interface to represent this data structure.
interface EmbedHit extends EmbedTarget {
  syntax: MdImageAttrs['syntax']
}

/**
 * The image or card whose source covers `pos`, if any.
 */
function getEmbedAt(state: EditorState, pos: number): EmbedHit | undefined {
  const range = getMarkRangeAt(state, pos, 'mdImage')
  if (!range) return
  const { from, to, mark } = range
  const { src, alt, syntax } = mark.attrs as MdImageAttrs
  const kind = matchEmbed(src) ?? 'image'
  return { kind, src, alt, syntax, from: from, to: to }
}

/**
 * The image or card that the selection covers exactly, as arrow keys select
 * it.
 */
function getSelectedEmbed(state: EditorState): EmbedHit | undefined {
  const { from, to, empty } = state.selection
  if (empty) return
  const embed = getEmbedAt(state, from)
  return embed && embed.from === from && embed.to === to ? embed : undefined
}

/**
 * Replace the X post or YouTube card at `pos` with an ordinary link and put
 * the caret after it. A card without alt text becomes its bare URL, which
 * renders as an autolink; otherwise the `![alt](src "title")` source loses its
 * `!`. The trailing magic comment (size and saved snapshot) is dropped. Images
 * and `![[target]]` embeds are not converted.
 */
export function convertEmbedToLink(pos: number): Command {
  return (state, dispatch) => {
    const embed = getEmbedAt(state, pos)
    if (!embed || embed.kind === 'image' || embed.syntax != null) return false
    if (dispatch) {
      const source = stripMagicComment(state.doc.textBetween(embed.from, embed.to))
      const link = embed.alt ? source.slice(1) : embed.src
      const transaction = state.tr.insertText(link, embed.from, embed.to)
      transaction.setSelection(TextSelection.create(transaction.doc, embed.from + link.length))
      dispatch(transaction.scrollIntoView())
    }
    return true
  }
}

/**
 * Delete the image or card at `pos`, with its source and magic comment, and
 * put the caret where it was.
 */
export function deleteEmbed(pos: number): Command {
  return (state, dispatch) => {
    const embed = getEmbedAt(state, pos)
    if (!embed) return false
    if (dispatch) {
      const transaction = state.tr.delete(embed.from, embed.to)
      transaction.setSelection(TextSelection.create(transaction.doc, embed.from))
      dispatch(transaction.scrollIntoView())
    }
    return true
  }
}

/**
 * The menu button of the card at `pos`, if the card is rendered.
 */
function getEmbedMenuButton(view: EditorView, pos: number): HTMLElement | undefined | null {
  const { node } = view.domAtPos(pos + 1)
  const element = isElementLike(node) ? node : node.parentElement
  const markView = element?.closest('.md-image-view')
  return markView?.querySelector<HTMLElement>(`.${EMBED_MENU_BUTTON_CLASS}`)
}

function getButtonTarget(target: EventTarget | null): HTMLElement | undefined | null {
  if (!isElementLike(target)) return
  return target.closest<HTMLElement>(`.${EMBED_MENU_BUTTON_CLASS}`)
}

/**
 * The card a menu button belongs to, found through the hidden source next to
 * the card, since an event on the non-editable card lands on a unit boundary.
 */
function getEmbedForButton(view: EditorView, button: HTMLElement): EmbedHit | undefined {
  const content = button.closest('.md-image-view')?.querySelector('.md-image-view-content')
  if (!content) return
  return getEmbedAt(view.state, view.posAtDOM(content, 0))
}

/**
 * Receives a request to open the menu of `embed`, anchored to `button`.
 */
export type EmbedMenuOpenHandler = (embed: EmbedTarget, button: HTMLElement) => void

/**
 * Show the menu button on images, X post cards, and YouTube cards, and call
 * `onOpen` when the user clicks it or presses `Mod-/` with one selected.
 * Install it only where a menu is rendered: without it, no button shows.
 */
export function defineEmbedMenuHandler(onOpen: EmbedMenuOpenHandler): PlainExtension {
  const openSelectedEmbed: Command = (state, dispatch, view) => {
    const embed = getSelectedEmbed(state)
    const button = embed && view && getEmbedMenuButton(view, embed.from)
    if (!embed || !button) return false
    if (dispatch) onOpen(embed, button)
    return true
  }

  return union(
    definePlugin(
      new Plugin({
        key: embedMenuKey,
        props: {
          attributes: { 'data-embed-menu': '' },
          handleDOMEvents: {
            // Keep the caret and focus where they are, and keep ProseMirror
            // from starting a selection on the non-editable card.
            mousedown: (_view, event) => {
              if (!getButtonTarget(event.target)) return false
              event.preventDefault()
              return true
            },
            click: (view, event) => {
              const button = getButtonTarget(event.target)
              if (!button) return false
              event.preventDefault()
              const embed = getEmbedForButton(view, button)
              if (embed) onOpen(embed, button)
              return true
            },
          },
        },
      }),
    ),
    defineKeymap({ 'Mod-/': openSelectedEmbed }),
  )
}
