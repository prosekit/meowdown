import { definePlugin } from '@prosekit/core'
import type { Transaction } from '@prosekit/pm/state'
import { Plugin, PluginKey } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

import { isMarkStep } from '../utils/is-mark-step.ts'

const SPELL_CHECK_PAUSE_TIMEOUT = 1200

function hasContentChanged(transactions: readonly Transaction[]): boolean {
  for (const tr of transactions) {
    for (const step of tr.steps) {
      if (!isMarkStep(step)) {
        return true
      }
    }
  }
  return false
}
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
  let paused = false
  let currentValue: boolean | undefined

  const update = () => {
    const dom = view && !view.isDestroyed && view.dom
    if (!dom) return

    const newValue = spellCheck && !paused

    if (newValue !== currentValue) {
      currentValue = newValue
      dom.spellcheck = newValue
    }
  }

  const pause = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    paused = true
    update()
    timeoutId = setTimeout(() => {
      paused = false
      update()
    }, SPELL_CHECK_PAUSE_TIMEOUT)
  }

  return {
    pause,
    apply(transactions: readonly Transaction[]): void {
      if (hasContentChanged(transactions)) {
        pause()
      }
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

function createSpellCheckPlugin(spellCheck: boolean) {
  const spellCheckKey = new PluginKey<SpellCheckPluginState>('spell-check')

  return new Plugin<SpellCheckPluginState>({
    key: spellCheckKey,

    state: {
      init: (): SpellCheckPluginState => {
        return createSpellCheckPluginState(spellCheck)
      },
      apply: (tr, pluginState) => {
        return pluginState
      },
    },

    view(view) {
      const plugnState = spellCheckKey.getState(view.state)
      return plugnState?.view(view) || {}
    },

    props: {
      handleDOMEvents: {
        beforeinput: (view) => {
          const plugnState = spellCheckKey.getState(view.state)
          plugnState?.pause()
        },
      },
    },

    appendTransaction(transactions, state) {
      const plugnState = spellCheckKey.getState(state)
      plugnState?.apply(transactions)
    },
  })
}

export function defineSpellCheckPlugin(spellCheck: boolean) {
  return definePlugin(createSpellCheckPlugin(spellCheck))
}
