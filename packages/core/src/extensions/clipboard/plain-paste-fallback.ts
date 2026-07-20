import { defineKeymap, definePlugin, union, type PlainExtension } from '@prosekit/core'
import type { ProseMirrorNode } from '@prosekit/pm/model'
import { Plugin, PluginKey, type Command } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

/**
 * How long to wait after a Mod-Shift-V keydown for the environment's own
 * paste event. Where the shortcut is native (a browser's "paste without
 * formatting" menu shortcut, an Electron `pasteAndMatchStyle` accelerator),
 * the paste event follows the keydown within a few milliseconds, so a short
 * pause is enough to tell "a native paste is coming" apart from "this
 * keystroke has no default action here".
 */
const NATIVE_PASTE_WAIT = 150

async function pastePlainClipboardText(view: EditorView, docAtArm: ProseMirrorNode) {
  let text: string
  try {
    text = await navigator.clipboard.readText()
  } catch {
    // The environment refused clipboard access; keep the status quo (the
    // keystroke does nothing) rather than fail loudly.
    return
  }
  // A changed doc means something else handled the keystroke after all (or
  // the user kept typing); pasting on top of it would double-insert.
  if (!text || view.isDestroyed || view.state.doc !== docAtArm) return
  view.pasteText(text)
}

/**
 * Make Mod-Shift-V (paste without formatting) work in environments where the
 * shortcut has no native paste behind it. Browsers bind it themselves and
 * ProseMirror's Shift-tracking turns the resulting paste event into a plain
 * paste, but desktop shells (a Tauri or Electron webview without a "Paste and
 * Match Style" menu item) deliver only the bare keydown — the user presses
 * the shortcut and nothing happens.
 *
 * The keydown is never consumed: where a native paste does exist it must keep
 * winning, since it needs no clipboard-read permission. Instead the keystroke
 * arms a short timer that a native paste event disarms; only when no paste
 * arrives does the fallback read the clipboard itself and run the text
 * through {@link EditorView.pasteText}, the exact code path of a Shift-paste.
 */
export function definePlainPasteFallback(): PlainExtension {
  let timeout: ReturnType<typeof setTimeout> | undefined

  const disarm = () => {
    if (timeout !== undefined) {
      clearTimeout(timeout)
      timeout = undefined
    }
  }

  const arm: Command = (state, dispatch, view) => {
    disarm()
    if (!view || !view.editable) return false
    if (typeof navigator === 'undefined' || !navigator.clipboard) return false
    const docAtArm = state.doc
    timeout = setTimeout(() => {
      timeout = undefined
      void pastePlainClipboardText(view, docAtArm)
    }, NATIVE_PASTE_WAIT)
    return false
  }

  return union(
    defineKeymap({ 'Mod-Shift-v': arm }),
    definePlugin(
      new Plugin({
        key: new PluginKey('meowdown-plain-paste-fallback'),
        props: {
          handleDOMEvents: {
            paste: () => {
              disarm()
              return false
            },
          },
        },
        view: () => ({ destroy: disarm }),
      }),
    ),
  )
}
