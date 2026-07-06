import { definePlugin, type PlainExtension } from '@prosekit/core'
import { closeHistory } from '@prosekit/pm/history'
import type { Slice } from '@prosekit/pm/model'
import { Plugin, PluginKey } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

import { matchEmbed } from './embed/index.ts'

const embedPasteKey = new PluginKey('meowdown-embed-paste')

export function detectEmbedUrl(text: string): string | undefined {
  const trimmed = text.trim()
  if (!trimmed || /\s/.test(trimmed)) return undefined
  return matchEmbed(trimmed) ? trimmed : undefined
}

export function getPastedText(event: ClipboardEvent, slice: Slice): string {
  const fromClipboard = event.clipboardData?.getData('text/plain')
  if (fromClipboard) return fromClipboard
  // Firefox ignores the standard `clipboardData` init member of the ClipboardEvent
  // constructor (Gecko reads non-standard `data`/`dataType` strings instead), so a
  // synthetic paste carries no text there; Chrome and WebKit honor it. Fall back to
  // the slice ProseMirror parsed from the paste, which holds the text on every engine.
  // See https://github.com/w3c/clipboard-apis/issues/33
  return slice.content.textBetween(0, slice.content.size, '\n')
}

function insertEmbedFromPaste(view: EditorView, url: string): void {
  const { from, to } = view.state.selection
  // Insert the raw URL as its own history event.
  view.dispatch(closeHistory(view.state.tr.insertText(url, from, to)))
  // Rewrite it to `![](url)` in a separate history event, so one undo restores the link.
  const rewrite = view.state.tr.insertText(`![](${url})`, from, from + url.length)
  view.dispatch(closeHistory(rewrite))
}

/**
 * Auto-embed a pasted tweet or YouTube link. When the clipboard holds exactly
 * one such URL, the link is rewritten to `![](url)`, which the image pipeline
 * renders as a rich embed. Not part of `defineEditorExtension`; the React
 * package applies it via the `embedPaste` prop (on by default).
 */
export function defineEmbedPaste(): PlainExtension {
  return definePlugin(
    new Plugin({
      key: embedPasteKey,
      props: {
        handlePaste: (view, event, slice) => {
          const parent = view.state.selection.$from.parent
          // Never in a code block
          if (!parent.inlineContent || parent.type.spec.code) return false
          const text = getPastedText(event, slice)
          if (!text) return false
          const url = detectEmbedUrl(text)
          if (!url) return false
          insertEmbedFromPaste(view, url)
          return true
        },
      },
    }),
  )
}
