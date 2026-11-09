import { isElementLike } from '@ocavue/utils'
import { defineDOMEventHandler, defineKeymap, union, type PlainExtension } from '@prosekit/core'
import { TextSelection, type Command, type EditorState } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

import { EMBED_MENU_BUTTON_CLASS } from '../class-names.ts'
import { findAtomViewAt } from '../utils/atom-view.ts'

import { findImageAt, findImageForElement, type EmbedHit } from './image-click.ts'
import { stripMagicComment } from './magic-comment.ts'

/**
 * The image or card that the selection covers exactly, as arrow keys select
 * it.
 */
function getSelectedEmbed(state: EditorState): EmbedHit | undefined {
  const { from, to, empty } = state.selection
  if (empty) return
  const embed = findImageAt(state, from)
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
    const embed = findImageAt(state, pos)
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
    const embed = findImageAt(state, pos)
    if (!embed) return false
    if (dispatch) dispatch(replaceEmbed(state, embed, ''))
    return true
  }
}

/**
 * Replace the source of `embed` with `text`, which may be empty, and put the
 * caret after the text.
 */
function replaceEmbed(state: EditorState, embed: EmbedHit, text: string) {
  const { from, to } = embed
  const tr = text ? state.tr.insertText(text, from, to) : state.tr.delete(from, to)
  return tr.setSelection(TextSelection.create(tr.doc, from + text.length)).scrollIntoView()
}

/**
 * The menu button of the card at `pos`, if the card is rendered.
 */
function getEmbedMenuButton(view: EditorView, pos: number): HTMLElement | undefined | null {
  return findAtomViewAt(view, pos + 1)?.querySelector<HTMLElement>(`.${EMBED_MENU_BUTTON_CLASS}`)
}

function getButtonTarget(target: EventTarget | null): HTMLElement | undefined | null {
  if (!isElementLike(target)) return
  return target.closest<HTMLElement>(`.${EMBED_MENU_BUTTON_CLASS}`)
}

/**
 * Receives a request to open the menu of `embed`, anchored to `button`.
 */
export type EmbedMenuOpenHandler = (embed: EmbedHit, button: HTMLElement) => void

/**
 * Call `onOpen` when the user clicks the menu button of an image, X post card,
 * or YouTube card, or presses `Mod-/` with one selected.
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
    // Keep the caret and focus where they are, and keep ProseMirror from
    // starting a selection on the non-editable card.
    defineDOMEventHandler('mousedown', (_view, event) => {
      if (!getButtonTarget(event.target)) return false
      event.preventDefault()
      return true
    }),
    defineDOMEventHandler('click', (view, event) => {
      const button = getButtonTarget(event.target)
      if (!button) return false
      event.preventDefault()
      const embed = findImageForElement(view, button)
      if (embed) onOpen(embed, button)
      return true
    }),
    defineKeymap({ 'Mod-/': openSelectedEmbed }),
  )
}
