import { definePlugin, type PlainExtension } from '@prosekit/core'
import { Plugin } from '@prosekit/pm/state'

/**
 * Block the macOS "smart dashes" rewrite. With the `spellcheck` attribute on,
 * WebKit rewrites already-typed `--` near the caret into an em dash and
 * delivers the rewrite as a cancelable `beforeinput` with
 * `inputType: 'insertReplacementText'`. That corrupts Markdown such as the
 * `-->` closing an image sizing comment, so cancel any replacement that
 * inserts an em dash; word-level autocorrect passes through.
 */
export function defineSystemSubstitutionGuard(): PlainExtension {
  return definePlugin(
    new Plugin({
      props: {
        handleDOMEvents: {
          beforeinput: (_view, event) => {
            if (event.inputType !== 'insertReplacementText') return false
            const replacement = event.dataTransfer?.getData('text/plain') || event.data || ''
            if (!replacement.includes('—')) return false
            event.preventDefault()
            return true
          },
        },
      },
    }),
  )
}
