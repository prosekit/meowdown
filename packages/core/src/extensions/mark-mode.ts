import { defineCommands, definePlugin, union } from '@prosekit/core'
import type { Mark, Slice } from '@prosekit/pm/model'
import type { Command, EditorState } from '@prosekit/pm/state'
import { Plugin, PluginKey } from '@prosekit/pm/state'
import { Decoration, DecorationSet } from '@prosekit/pm/view'

import { getOutermostPackRangeAt } from './hidden-run.ts'
import type { MarkName } from './mark-names.ts'

/**
 * Controls how markdown syntax characters are rendered and how the
 * editor serializes content to the clipboard.
 *
 * - 'hide':  syntax chars never visible; copy strips them.
 * - 'focus': syntax chars hidden by default; revealed near cursor; copy strips them.
 * - 'show':  syntax chars always visible (dim grey); copy keeps them.
 */
export type MarkMode = 'hide' | 'focus' | 'show'

// Marks whose text is dropped from a clean clipboard copy, so copied markdown
// omits the rendered syntax. The image/wikilink sources carry only their own
// mark, so they are kept verbatim (`![alt](url)`, `[[target]]`).
const CLIPBOARD_STRIP_MARK_NAMES: ReadonlySet<MarkName> = new Set<MarkName>([
  'mdMark',
  'mdLinkUri',
  'mdLinkTitle',
])

const markModeKey = new PluginKey<MarkMode>('mark-mode')

function getCurrentMarkMode(state: EditorState): MarkMode | undefined {
  return markModeKey.getState(state)
}

function createMarkModePlugin(initialMode: MarkMode): Plugin<MarkMode> {
  return new Plugin<MarkMode>({
    key: markModeKey,
    state: {
      init: () => initialMode,
      apply: (tr, value) => (tr.getMeta(markModeKey) as MarkMode | undefined) ?? value,
    },
    props: {
      attributes: (state) => {
        return { 'data-mark-mode': getCurrentMarkMode(state) ?? initialMode }
      },
      decorations: (state) => {
        return getCurrentMarkMode(state) === 'focus' ? computeFocusDecorations(state) : undefined
      },
      // In show mode the empty string is falsy, so `someProp` falls through to
      // the next serializer (`defineMarkdownCopy` in the full editor) and the
      // copied text keeps the syntax.
      clipboardTextSerializer: (slice, view) => {
        return getCurrentMarkMode(view.state) === 'show' ? '' : cleanCopySerializer(slice)
      },
    },
  })
}

function setMarkMode(mode: MarkMode): Command {
  return (state, dispatch) => {
    if (getMarkMode(state) === mode) return false
    // A meta-only transaction: no doc steps, so undo cannot revert the mode.
    dispatch?.(state.tr.setMeta(markModeKey, mode))
    return true
  }
}

export function defineMarkMode(mode: MarkMode) {
  return union(definePlugin(createMarkModePlugin(mode)), defineCommands({ setMarkMode }))
}

/**
 * The active mark mode. `defineEditorExtension` always applies
 * `defineMarkMode`, so this is `undefined` only for a state built without it.
 */
export function getMarkMode(state: EditorState): MarkMode | undefined {
  return markModeKey.getState(state)
}

function cleanCopySerializer(slice: Slice): string {
  const blocks: string[] = []
  slice.content.forEach((blockNode) => {
    const parts: string[] = []
    blockNode.descendants((textNode) => {
      if (!textNode.isText || !textNode.text) return true
      const stripped = textNode.marks.some((m: Mark) =>
        CLIPBOARD_STRIP_MARK_NAMES.has(m.type.name as MarkName),
      )
      if (!stripped) parts.push(textNode.text)
      return false
    })
    blocks.push(parts.join(''))
  })
  // Single '\n' between blocks (not '\n\n'): output mirrors "what the user
  // sees on screen", not the markdown paragraph convention.
  return blocks.join('\n')
}

/**
 * In focus mode, reveal the markdown syntax of the inline unit under the caret.
 *
 * Every revealable unit (emphasis, strong, code, strikethrough, link, autolink,
 * image) carries one `mdPack` mark spanning it. Nested units stack one pack per
 * level and the order of same-type marks in a mark set follows edit history,
 * so the reveal expands every pack instance on the caret's character and takes
 * the outermost range. One decoration over that range flips the hidden
 * punctuation/url/source visible via the `.show` CSS rule. The character after
 * the caret is preferred, falling back to the one before, so a caret at either
 * edge (e.g. right after a link's `)`) still reveals the unit. Wikilink and
 * `#tag` carry no `mdPack`, so they never reveal.
 */
function computeFocusDecorations(state: EditorState): DecorationSet {
  const { selection } = state
  if (!selection.empty) return DecorationSet.empty

  const $pos = selection.$head
  const { parent } = $pos
  if (!parent.isTextblock || parent.type.spec.code) return DecorationSet.empty

  const range =
    getOutermostPackRangeAt(state, $pos.pos) ?? getOutermostPackRangeAt(state, $pos.pos - 1)
  if (!range) return DecorationSet.empty

  return DecorationSet.create(state.doc, [
    Decoration.inline(range.from, range.to, { class: 'show' }),
  ])
}
