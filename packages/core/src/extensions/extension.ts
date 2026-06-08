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
import { defineHeading } from '@prosekit/extensions/heading'
import { defineHorizontalRule } from '@prosekit/extensions/horizontal-rule'
import { defineList } from '@prosekit/extensions/list'
import { defineModClickPrevention } from '@prosekit/extensions/mod-click-prevention'
import { defineParagraph } from '@prosekit/extensions/paragraph'
import { defineTable } from '@prosekit/extensions/table'
import { defineText } from '@prosekit/extensions/text'
import { defineVirtualSelection } from '@prosekit/extensions/virtual-selection'

import { defineInlineMarkPlugin } from './inline-mark-plugin.ts'
import { defineInlineMarks } from './inline-marks.ts'

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
    defineInlineMarkPlugin(),

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
