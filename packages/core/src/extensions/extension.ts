import {
  defineBaseCommands,
  defineBaseKeymap,
  defineHistory,
  union,
  type Editor,
} from '@prosekit/core'
import { defineBlockquote } from '@prosekit/extensions/blockquote'
import { defineCodeBlock } from '@prosekit/extensions/code-block'
import { defineDoc } from '@prosekit/extensions/doc'
import { defineGapCursor } from '@prosekit/extensions/gap-cursor'
import { defineModClickPrevention } from '@prosekit/extensions/mod-click-prevention'
import { defineText } from '@prosekit/extensions/text'
import { defineVirtualSelection } from '@prosekit/extensions/virtual-selection'

import { defineAtomMarkNavigation } from './atom-mark-navigation.ts'
import { defineCaretMarkerSnap } from './caret-marker-snap.ts'
import { defineCodeBlockSyntaxHighlight } from './code-block-highlight.ts'
import { defineEditorCommands } from './commands.ts'
import { defineDocFrontmatterAttr } from './frontmatter.ts'
import { defineHeading } from './heading.ts'
import { defineMeowdownHorizontalRule } from './horizontal-rule.ts'
import { defineHTMLComment } from './html-comment.ts'
import { defineInlineMarkPlugin } from './inline-mark-plugin.ts'
import { defineInlineMarks } from './inline-marks.ts'
import { defineInlineToggle } from './inline-toggle-commands.ts'
import { defineLinkCommands } from './link-commands.ts'
import { defineMeowdownList } from './list.ts'
import { defineMeowdownParagraph } from './paragraph.ts'
import { defineTable } from './table.ts'
import { defineWikilink } from './wikilink.ts'

function defineEditorExtensionImpl() {
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
    defineInlineMarkPlugin(),
    defineInlineToggle(),
    defineLinkCommands(),
    defineWikilink(),
    defineAtomMarkNavigation({
      marks: [
        { name: 'mdImage', modes: ['hide', 'focus', 'show'] },
        { name: 'mdWikilink', modes: ['hide', 'focus', 'show'] },
      ],
    }),
    defineCaretMarkerSnap(),

    // others
    defineBaseKeymap(),
    defineBaseCommands(),
    defineHistory(),
    defineGapCursor(),
    defineVirtualSelection(),
    defineModClickPrevention(),
    defineEditorCommands(),
  )
}

export type EditorExtension = ReturnType<typeof defineEditorExtensionImpl>

export function defineEditorExtension(): EditorExtension {
  return defineEditorExtensionImpl()
}

export type TypedEditor = Editor<EditorExtension>
