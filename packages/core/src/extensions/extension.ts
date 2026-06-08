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
import { defineMarkModePlugin, type MarkMode } from './mark-mode-plugin.ts'

export interface EditorExtensionOptions {
  /**
   * Controls how markdown syntax characters are rendered and how the
   * editor serializes content to the clipboard.
   *
   * - 'hide':  syntax chars never visible; copy strips them.
   * - 'focus': syntax chars hidden by default; revealed near cursor; copy strips them.
   * - 'show':  syntax chars always visible (dim grey); copy keeps them.
   *
   * @default 'focus'
   */
  markMode?: MarkMode
}

function defineEditorExtensionImpl(options: EditorExtensionOptions = {}) {
  const mode = options.markMode ?? 'focus'
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
    defineMarkModePlugin(mode),

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

export function defineEditorExtension(options: EditorExtensionOptions = {}): EditorExtension {
  return defineEditorExtensionImpl(options)
}

export type TypedEditor = Editor<EditorExtension>
