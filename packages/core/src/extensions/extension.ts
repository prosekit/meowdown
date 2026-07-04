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
import type { FileLinkOptions } from './inline-text-to-mark-chunks.ts'
import { defineInlineToggle } from './inline-toggle-commands.ts'
import { defineLinkCommands } from './link-commands.ts'
import { defineMeowdownList } from './list.ts'
import { defineMoveBlock } from './move-block.ts'
import { defineMeowdownParagraph } from './paragraph.ts'
import { definePendingReplacement } from './pending-replacement.ts'
import { defineTable } from './table.ts'
import { defineVirtualCaret } from './virtual-caret.ts'
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
    defineInlineMarkPlugin(options),
    defineInlineToggle(),
    defineLinkCommands(),
    defineWikilink(),
    defineVirtualCaret(),
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
  )
}

export type EditorExtension = ReturnType<typeof defineEditorExtensionImpl>

/**
 * Options for {@link defineEditorExtension}. Creation-time configuration: it
 * is baked into the editor's parse pipeline, so changing it requires
 * rebuilding the editor.
 */
export type EditorExtensionOptions = FileLinkOptions

export function defineEditorExtension(options: EditorExtensionOptions = {}): EditorExtension {
  return defineEditorExtensionImpl(options)
}

export type TypedEditor = Editor<EditorExtension>
