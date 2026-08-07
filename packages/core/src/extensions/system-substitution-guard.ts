import { definePlugin, type PlainExtension } from '@prosekit/core'
import type { EditorState } from '@prosekit/pm/state'
import { Plugin } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

import { ATOM_MARK_NAMES, isMarkOfTypes, SYNTAX_MARK_NAMES, type MarkName } from './mark-names.ts'

// En/em dash and curly quotes: the characters macOS "smart quotes and dashes"
// rewrites already-typed straight punctuation into.
const SMART_PUNCTUATION = /[–—‘’“”]/

// Ranges where any OS rewrite breaks parsing: syntax characters, atom sources
// (wiki links, image/file/math sources, including an image's trailing sizing
// comment), and code.
const PROTECTED_MARK_NAMES: readonly MarkName[] = [
  ...SYNTAX_MARK_NAMES,
  ...ATOM_MARK_NAMES,
  'mdCode',
]

/**
 * Whether `[from, to)` touches text the OS must not rewrite: characters
 * carrying a syntax, atom-source, or code mark, or a code block's content.
 */
export function isProtectedRange(state: EditorState, from: number, to: number): boolean {
  let found = false
  state.doc.nodesBetween(from, to, (node) => {
    if (found) return false
    if (node.isTextblock && node.type.spec.code) found = true
    if (node.isText && node.marks.some((mark) => isMarkOfTypes(mark, PROTECTED_MARK_NAMES))) {
      found = true
    }
    return !found
  })
  return found
}

function shouldBlockReplacement(view: EditorView, event: InputEvent): boolean {
  if (event.inputType !== 'insertReplacementText') return false

  const replacement = event.dataTransfer?.getData('text/plain') || event.data || ''
  if (SMART_PUNCTUATION.test(replacement)) return true

  for (const staticRange of event.getTargetRanges()) {
    let from: number
    let to: number
    try {
      from = view.posAtDOM(staticRange.startContainer, staticRange.startOffset)
      to = view.posAtDOM(staticRange.endContainer, staticRange.endOffset)
    } catch {
      continue
    }
    if (from >= 0 && to >= from && isProtectedRange(view.state, from, to)) return true
  }
  return false
}

/**
 * Block the OS text substitutions that would corrupt Markdown syntax.
 *
 * With the `spellcheck` attribute on, macOS WebKit rewrites already-typed text
 * near the caret (smart quotes/dashes, autocorrect, user text replacements),
 * delivering each rewrite as a cancelable `beforeinput` with
 * `inputType: 'insertReplacementText'`. A rewrite is cancelled when its
 * replacement contains smart punctuation (`defineSubstitution` covers that
 * typography deliberately, with undo and code-span exemptions) or when its
 * target range is protected per {@link isProtectedRange}. Word-level
 * autocorrect in visible prose passes through.
 */
export function defineSystemSubstitutionGuard(): PlainExtension {
  return definePlugin(
    new Plugin({
      props: {
        handleDOMEvents: {
          beforeinput: (view, event) => {
            if (!shouldBlockReplacement(view, event)) return false
            event.preventDefault()
            return true
          },
        },
      },
    }),
  )
}
