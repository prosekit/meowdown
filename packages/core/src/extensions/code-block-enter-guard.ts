import { definePlugin, Priority, withPriority, type PlainExtension } from '@prosekit/core'
import { Plugin } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

import { isWebKit } from '../utils/browser.ts'

/**
 * Convert WebKit's native Enter inside a code block back into the keymap
 * pipeline. prosemirror-view deliberately skips `preventDefault` on some
 * Safari Enter keydowns: every plain Enter on iOS, and on desktop the first
 * keydown within 500ms after `compositionend` (WebKit fires `compositionend`
 * before the keydown that commits an IME composition, so that keydown is
 * swallowed as a likely IME confirmation). The browser's native
 * `insertParagraph` then clone-splits the `<pre>`, and the node view wrapper
 * DOM defeats prosemirror-view's DOM-change repair: a rogue `<br>` stays
 * behind, or the text before the caret is silently deleted. ProseMirror
 * cancels every Enter keydown a command handles, so an uncanceled native
 * `insertParagraph` or `insertLineBreak` in a code block is always such a
 * leak; cancel it and run the key through the handlers instead.
 */
export function defineCodeBlockEnterGuard(): PlainExtension {
  const plugin = new Plugin({
    props: {
      handleDOMEvents: {
        beforeinput: (view, event) => {
          if (!isWebKit || !event.cancelable) return false
          if (event.inputType !== 'insertParagraph' && event.inputType !== 'insertLineBreak') {
            return false
          }
          const { $from } = view.state.selection
          if (!$from.parent.type.spec.code) return false

          event.preventDefault()

          // After an iOS Enter keydown, prosemirror-view schedules a synthetic
          // Enter 200ms later as a fallback for the native edit this guard just
          // canceled; clear the flag so the fallback cannot insert a second
          // newline.
          const input = (view as EditorView & { input?: { lastIOSEnter: number } }).input
          if (input != null) input.lastIOSEnter = 0

          const keydown = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            shiftKey: event.inputType === 'insertLineBreak',
          })
          view.someProp('handleKeyDown', (handler) => handler(view, keydown))
          return true
        },
      },
    },
  })

  return withPriority(definePlugin(plugin), Priority.highest)
}
