import { once } from '@ocavue/utils'
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
import { defineList } from '@prosekit/extensions/list'
import { defineModClickPrevention } from '@prosekit/extensions/mod-click-prevention'
import { defineParagraph } from '@prosekit/extensions/paragraph'
import { defineText } from '@prosekit/extensions/text'
import { defineVirtualSelection } from '@prosekit/extensions/virtual-selection'
import type { Schema } from '@prosekit/pm/model'
import { defineCodeBlockSyntaxHighlight } from './code-block-highlight.ts'
import { defineHeading } from './heading.ts'
import { defineInlineMarkPlugin } from './inline-mark-plugin.ts'
import { defineInlineMarks } from './inline-marks.ts'
import { defineInlineToggle } from './inline-toggle-commands.ts'
import { defineTable } from './table.ts'

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
export type TypedNodeBuilders = 'TODO'
export type TypedMarkBuilders = 'TODO'

// TODO: move getSharedSchema to a separate module `schema.ts`;
const getSharedSchema: () => Schema = /* @__PURE__ */ once(() => {
  const schema = defineEditorExtension().schema
  if (!schema) {
    throw new Error('Unexpected empty schema')
  }
  return schema
})

// TODO: move TypedNodeBuilders, TypedMarkBuilders, getNodeBuilders and getMarkBuilders to a separate module `schema.ts` and add some test;
export const getNodeBuilders: () => TypedNodeBuilders = /* @__PURE__ */ once(() => {
  const schema = getSharedSchema()
  return 'TODO'
})

export const getMarkBuilders: () => TypedMarkBuilders = /* @__PURE__ */ once(() => {
  const schema = getSharedSchema()
  return 'TODO'
})
