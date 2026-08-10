import { definePlugin, Priority, withPriority, type PlainExtension } from '@prosekit/core'
import { Plugin } from '@prosekit/pm/state'

const EM_DASH = '\u{2014}'

/**
 * Block the macOS "smart dashes" rewrite. With the `spellcheck` attribute on,
 * WebKit rewrites already-typed `--` near the caret into an em dash and
 * delivers the rewrite as a cancelable `beforeinput` with
 * `inputType: 'insertReplacementText'`. That corrupts Markdown such as the
 * `-->` closing an image sizing comment, so cancel any replacement that
 * inserts an em dash; word-level autocorrect passes through.
 */
export function defineSystemSubstitutionGuard(): PlainExtension {
  const plugin = new Plugin({
    props: {
      handleDOMEvents: {
        beforeinput: (view, event) => {
          if (event.inputType !== 'insertReplacementText') return false

          const replacement = event.dataTransfer?.getData('text/plain') || event.data || ''
          if (!replacement.includes(EM_DASH)) return false

          event.preventDefault()

          // Restore the selection after the cancelation. See WebKit bug: https://bugs.webkit.org/show_bug.cgi?id=321420
          const { doc, selection } = view.state
          requestAnimationFrame(() => {
            const { state } = view
            if (view.isDestroyed || state.doc !== doc || state.selection.eq(selection)) return
            view.dispatch(state.tr.setSelection(selection))
          })

          return true
        },
      },
    },
  })

  return withPriority(definePlugin(plugin), Priority.highest)
}
