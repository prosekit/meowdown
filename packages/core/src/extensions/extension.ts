import {
  defineBaseCommands,
  defineBaseKeymap,
  defineHistory,
  union,
  type Editor,
} from '@prosekit/core'
import { defineBlockquote } from '@prosekit/extensions/blockquote'
import { defineDoc } from '@prosekit/extensions/doc'
import { defineGapCursor } from '@prosekit/extensions/gap-cursor'
import { defineModClickPrevention } from '@prosekit/extensions/mod-click-prevention'
import { defineText } from '@prosekit/extensions/text'
import { defineVirtualSelection } from '@prosekit/extensions/virtual-selection'

import { ATOM_SOURCE_MARK_NAMES, defineAtomMarkNavigation } from './atom-mark-navigation.ts'
import { defineClipboard } from './clipboard/clipboard.ts'
import { defineCodeBlockSyntaxHighlight } from './code-block-highlight.ts'
import { defineCodeBlock } from './code-block.ts'
import { defineEditorCommands } from './commands.ts'
import { defineEscapeCollapse } from './escape-collapse.ts'
import { defineDocFrontmatterAttr } from './frontmatter.ts'
import { defineHeading } from './heading.ts'
import { defineHiddenRunCaret } from './hidden-run-caret.ts'
import { defineMeowdownHorizontalRule } from './horizontal-rule.ts'
import { defineHTMLComment } from './html-comment.ts'
import { defineInlineMarkPlugin } from './inline-mark-plugin.ts'
import { defineInlineMarks } from './inline-marks.ts'
import type { InlineMarkOptions } from './inline-text-to-mark-chunks.ts'
import { defineInlineToggle } from './inline-toggle-commands.ts'
import { defineLinkCommands } from './link-commands.ts'
import { defineMeowdownList } from './list.ts'
import { defineMarkMode, type MarkMode } from './mark-mode.ts'
import { defineMath } from './math.ts'
import { defineMoveBlock } from './move-block.ts'
import { defineMeowdownParagraph } from './paragraph.ts'
import { definePendingReplacement } from './pending-replacement.ts'
import { defineScrollToSelection } from './scroll-to-selection.ts'
import { defineSelectDocBoundary } from './select-doc-boundary.ts'
import { defineTable } from './table.ts'
import { defineVirtualCaret } from './virtual-caret.ts'
import { defineWikilinkTargetResolution } from './wikilink-target-resolution.ts'
import { defineWikilink } from './wikilink.ts'

function defineEditorExtensionImpl(options: EditorExtensionOptions) {
  return union(
    // nodes
    defineMeowdownParagraph(),
    defineDoc(),
    defineDocFrontmatterAttr(),
    defineText(),
    defineBlockquote(),
    defineMeowdownList(),
    defineHeading(),
    defineTable(),
    defineCodeBlock(),
    defineMeowdownHorizontalRule(),
    defineHTMLComment(),

    // marks
    defineInlineMarks(),

    // plugins
    defineCodeBlockSyntaxHighlight(),
    defineEscapeCollapse(),
    defineMoveBlock(),
    defineSelectDocBoundary(),
    defineInlineMarkPlugin(options),
    defineInlineToggle(),
    defineLinkCommands(),
    defineWikilink(),
    defineMath(),
    defineMarkMode(options.markMode ?? 'focus'),
    defineClipboard(),
    defineVirtualCaret(),
    defineScrollToSelection(),
    defineHiddenRunCaret(),
    defineAtomMarkNavigation({
      marks: ATOM_SOURCE_MARK_NAMES.map((name) => ({ name, modes: ['hide', 'focus', 'show'] })),
    }),

    // others
    defineBaseKeymap(),
    defineBaseCommands(),
    defineHistory(),
    defineGapCursor(),
    defineVirtualSelection(),
    defineModClickPrevention(),
    defineEditorCommands(),
    definePendingReplacement(),
    defineWikilinkTargetResolution(),
  )
}

export type EditorExtension = ReturnType<typeof defineEditorExtensionImpl>

/**
 * Options for {@link defineEditorExtension}. Creation-time configuration:
 * `resolveFileLink` and `resolveWikiEmbed` are baked into the editor's parse
 * pipeline, so changing them requires rebuilding the editor; `markMode` is
 * only the initial value.
 */
export type EditorExtensionOptions = InlineMarkOptions & {
  /**
   * The initial mark mode, applied from the first paint. Defaults to
   * `'focus'`. Switch later with the `setMarkMode` command.
   */
  markMode?: MarkMode
}

export function defineEditorExtension(options: EditorExtensionOptions = {}): EditorExtension {
  return defineEditorExtensionImpl(options)
}

export type TypedEditor = Editor<EditorExtension>
