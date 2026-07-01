import { definePlugin } from '@prosekit/core'
import type { Transaction } from '@prosekit/pm/state'
import { Plugin, PluginKey } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

import { isMarkStep } from '../utils/is-mark-step.ts'

/**
 * Stop macOS from rewriting straight punctuation into "smart" punctuation as
 * the user types.
 *
 * On macOS, WebKit applies the system "smart quotes and dashes" substitution
 * inside `contenteditable` when `spellcheck` is true. Typing right after the hidden
 * `<!-- {"width":..,"height":..} -->` sizing comment that backs an image lets
 * it rewrite the `--` in `-->` into an em dash. which invalidates the comment so
 * meowdown can no longer parse it and it leaks into the note as literal text.
 *
 * We disable the `spellcheck` attribute for a few seconds before any doc
 * change transaction. This would prevent the smart punctuation substitution from happening.
 */
function createSpellCheckPluginState(spellCheck: boolean) {
  let view: EditorView | undefined
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let disabled = false

  return {
    apply(tr: Transaction): void {
      if (!spellCheck || !view || !tr.docChanged || tr.steps.every(isMarkStep)) {
        return
      }

      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      disabled = true
      timeoutId = setTimeout(() => {
        disabled = false
      }, 1200)
    },

    attributes(): Record<string, string> {
      const enabled = spellCheck && !disabled
      return { spellcheck: enabled ? 'true' : 'false' }
    },

    view(editorView: EditorView) {
      view = editorView
      return {
        destroy() {
          view = undefined
        },
      }
    },
  }
}

type SpellCheckPluginState = ReturnType<typeof createSpellCheckPluginState>

const spellCheckKey = new PluginKey<SpellCheckPluginState>('spell-check')

function createSpellCheckPlugin(spellCheck: boolean) {
  return new Plugin<SpellCheckPluginState>({
    key: spellCheckKey,

    state: {
      init: (): SpellCheckPluginState => {
        return createSpellCheckPluginState(spellCheck)
      },
      apply: (tr, pluginState) => {
        pluginState.apply(tr)
        return pluginState
      },
    },

    props: {
      attributes: (state): Record<string, string> => {
        const plugnState = spellCheckKey.getState(state)
        return plugnState?.attributes() || {}
      },
    },

    view(view) {
      const plugnState = spellCheckKey.getState(view.state)
      return plugnState?.view(view) || {}
    },
  })
}

export function defineSpellCheckPlugin(spellCheck: boolean) {
  return definePlugin(createSpellCheckPlugin(spellCheck))
}
