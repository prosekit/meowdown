import { getAutolinkHref } from '@meowdown/markdown'
import { definePlugin, Priority, withPriority, type PlainExtension } from '@prosekit/core'
import { Plugin, PluginKey } from '@prosekit/pm/state'

import { executeCommand } from '../utils/execute-command.ts'

import { insertLink } from './link-commands.ts'
import { getPastedText } from './paste.ts'

const linkPasteKey = new PluginKey('meowdown-link-paste')

/**
 * The pasted text as a link `href` when the clipboard holds exactly one URL:
 * a `scheme:` URI, a `www.`/bare-domain URL (implied `https://`), or an email
 * (implied `mailto:`) — the same shapes autolinking recognizes.
 */
export function detectLinkUrl(text: string): string | undefined {
  const trimmed = text.trim()
  if (!trimmed || /\s/.test(trimmed)) return undefined
  return getAutolinkHref(trimmed)
}

/**
 * Paste a URL over selected text to wrap the selection as a Markdown link
 * `[selected text](url)`. Only fires when the clipboard holds exactly one URL
 * and the selection is a non-empty text selection inside a single non-code
 * textblock; otherwise the paste falls through to the other handlers
 * (embed paste, plain paste). One undo restores the plain selected text.
 *
 * Registered with `Priority.high` so its `handlePaste` runs before
 * `defineEmbedPaste`'s: pasting an embeddable URL (tweet/YouTube) over a
 * selection keeps the selected text as a link instead of discarding it for an
 * embed. Not part of `defineEditorExtension`; the React package applies it via
 * the `linkPaste` prop (on by default).
 */
export function defineLinkPaste(): PlainExtension {
  return withPriority(
    definePlugin(
      new Plugin({
        key: linkPasteKey,
        props: {
          handlePaste: (view, event, slice) => {
            const text = getPastedText(event, slice)
            if (!text) return false
            const href = detectLinkUrl(text)
            if (!href) return false
            return executeCommand(
              view,
              insertLink({
                href,
                // Put the caret after the link so the user can continue typing without having to move it.
                wrapText: false,
              }),
            )
          },
        },
      }),
    ),
    Priority.high,
  )
}
