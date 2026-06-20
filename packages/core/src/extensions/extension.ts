import {
  defineBaseCommands,
  defineBaseKeymap,
  defineHistory,
  type Editor,
  union,
} from '@prosekit/core'
import { defineBlockquote } from '@prosekit/extensions/blockquote'
import { defineCodeBlock } from '@prosekit/extensions/code-block'
import { defineDoc } from '@prosekit/extensions/doc'
import { defineGapCursor } from '@prosekit/extensions/gap-cursor'
import { defineHorizontalRule } from '@prosekit/extensions/horizontal-rule'
import { defineModClickPrevention } from '@prosekit/extensions/mod-click-prevention'
import { defineParagraph } from '@prosekit/extensions/paragraph'
import { defineText } from '@prosekit/extensions/text'
import { defineVirtualSelection } from '@prosekit/extensions/virtual-selection'

import { defineAtomicMarkNavigation } from './atomic-mark-navigation.ts'
import { defineCodeBlockSyntaxHighlight } from './code-block-highlight.ts'
import { defineHeading } from './heading.ts'
import { defineInlineMarkPlugin } from './inline-mark-plugin.ts'
import { defineInlineMarks } from './inline-marks.ts'
import { defineInlineToggle } from './inline-toggle-commands.ts'
import { defineList } from './list.ts'
import { defineTable } from './table.ts'
import { defineWikilink } from './wikilink.ts'

function defineEditorExtensionImpl() {
  return union(
    // nodes
    defineParagraph(),
    defineDoc(),
    defineText(),
    defineBlockquote(),
    defineList(),
    defineHeading(),
    defineTable(),
    defineCodeBlock(),
    defineHorizontalRule(),

    // marks
    defineInlineMarks(),

    // plugins
    defineCodeBlockSyntaxHighlight(),
    defineInlineMarkPlugin(),
    defineInlineToggle(),
    defineWikilink(),
    defineAtomicMarkNavigation({
      marks: [
        { name: 'mdImageSource', modes: ['hide'] },
        { name: 'mdWikilinkSource', modes: ['hide', 'focus', 'show'] },
      ],
      selectedClass: 'md-atomic-selected',
    }),

    // others
    defineBaseKeymap(),
    defineBaseCommands(),
    defineHistory(),
    defineGapCursor(),
    defineVirtualSelection(),
    defineModClickPrevention(),
  )
}

export type EditorExtension = ReturnType<typeof defineEditorExtensionImpl>

export function defineEditorExtension(): EditorExtension {
  return defineEditorExtensionImpl()
}

export type TypedEditor = Editor<EditorExtension>
