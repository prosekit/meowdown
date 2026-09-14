import { definePlugin, type PlainExtension } from '@prosekit/core'
import { closeHistory } from '@prosekit/pm/history'
import { Plugin, PluginKey, type EditorState } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

import { getPastedText } from './paste.ts'
import { matchPostEmbed } from './post-embed.ts'

const embedPasteKey = new PluginKey('meowdown-embed-paste')

export function detectEmbedUrl(text: string): string | undefined {
  const trimmed = text.trim()
  if (!trimmed || /\s/.test(trimmed)) return undefined
  return matchPostEmbed(trimmed) ? trimmed : undefined
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
 * renders as a rich embed. Enable it through the `embedPaste` configuration
 * or install this standalone extension. The React prop defaults to enabled.
 */
export function defineEmbedPaste(enabled?: (state: EditorState) => boolean): PlainExtension {
  return definePlugin(
    new Plugin({
      key: enabled ? new PluginKey('config-defineEmbedPaste') : embedPasteKey,
      props: {
        handlePaste: (view, event, slice) => {
          if (enabled && !enabled(view.state)) return false
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
