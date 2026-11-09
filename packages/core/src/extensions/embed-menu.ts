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

import { getAtomViewAt } from '../utils/atom-view.ts'

import { findImageAt, findImageForElement } from './image-click.ts'
import { EMBED_MENU_BUTTON_CLASS } from './image.ts'
import type { MdImageAttrs } from './inline-marks.ts'
import { stripMagicComment } from './magic-comment.ts'

const embedMenuKey = new PluginKey('meowdown-embed-menu')

/**
 * An image, X post, or YouTube card in the document: its `![](src)` or
 * `![[target]]` source, including any trailing magic comment, spans `from` to
 * `to`. `src` is the image or post URL.
 * FIXME: now ImageHit already have "kind", we do not need "EmbedTarget" anymore.
 */
export interface EmbedTarget {
  kind: EmbedKind | 'image'
  src: string
  alt: string
  /**
   * `wikiEmbed` for a `![[target]]` source, which does not convert to a link.
   */
  syntax: MdImageAttrs['syntax']
  from: number
  to: number
}

/**
 * Tag an image found in the document with the kind of card its URL renders.
 * FIXME: now ImageHit already have "kind", we do not need to call this function anymore.
 */
function toEmbedTarget(image: Omit<EmbedTarget, 'kind'> | undefined): EmbedTarget | undefined {
  return image && { ...image, kind: matchEmbed(image.src) ?? 'image' }
}

/**
 * The image or card whose source covers `pos`, if any.
 */
function getEmbedAt(state: EditorState, pos: number): EmbedTarget | undefined {
  return toEmbedTarget(findImageAt(state, pos))
}

/**
 * The image or card that the selection covers exactly, as arrow keys select
 * it.
 */
function getSelectedEmbed(state: EditorState): EmbedTarget | undefined {
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
      dispatch(replaceEmbed(state, embed, embed.alt ? source.slice(1) : embed.src))
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
    if (dispatch) dispatch(replaceEmbed(state, embed, ''))
    return true
  }
}

/**
 * Replace the source of `embed` with `text`, which may be empty, and put the
 * caret after the text.
 */
function replaceEmbed(state: EditorState, embed: EmbedTarget, text: string) {
  const { from, to } = embed
  const tr = text ? state.tr.insertText(text, from, to) : state.tr.delete(from, to)
  return tr.setSelection(TextSelection.create(tr.doc, from + text.length)).scrollIntoView()
}

/**
 * The menu button of the card at `pos`, if the card is rendered.
 */
function getEmbedMenuButton(view: EditorView, pos: number): HTMLElement | undefined | null {
  return getAtomViewAt(view, pos + 1)?.querySelector<HTMLElement>(`.${EMBED_MENU_BUTTON_CLASS}`)
}

function getButtonTarget(target: EventTarget | null): HTMLElement | undefined | null {
  if (!isElementLike(target)) return
  return target.closest<HTMLElement>(`.${EMBED_MENU_BUTTON_CLASS}`)
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
              const embed = toEmbedTarget(findImageForElement(view, button))
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
