import {
  defineNodeSpec,
  Priority,
  union,
  withPriority,
  type Extension,
  type Union,
} from '@prosekit/core'
import {
  defineParagraphCommands,
  defineParagraphKeymap,
  type ParagraphCommandsExtension,
} from '@prosekit/extensions/paragraph'
import type { Attrs, ProseMirrorNode, TagParseRule } from '@prosekit/pm/model'

import { semanticTextblockDOM, sourceTextRule } from './clipboard/semantic-inline.ts'
import type { NodeName } from './node-names.ts'

type ParagraphSpecExtension = Extension<{
  Nodes: { paragraph: Attrs }
}>

function defineMeowdownParagraphSpec(): ParagraphSpecExtension {
  return defineNodeSpec({
    name: 'paragraph' satisfies NodeName,
    content: 'inline*',
    group: 'block',

    // makes the DOM parser preserve the newline, so a multi-line paragraph survives editing
    whitespace: 'pre',

    parseDOM: [{ tag: 'p' }],
    toDOM() {
      return ['p', 0]
    },
  })
}

/** The clipboard DOM of a paragraph: semantic inline content plus `data-md`. */
export function paragraphClipboardDOM(node: ProseMirrorNode): HTMLElement {
  return semanticTextblockDOM('p', node)
}

/** The clipboard parse rules restoring a paragraph's source text from `data-md`. */
export function paragraphFromDOM(): TagParseRule[] {
  return [sourceTextRule('p', 'paragraph' satisfies NodeName)]
}

type MeowdownParagraphExtension = Union<[ParagraphSpecExtension, ParagraphCommandsExtension]>

export function defineMeowdownParagraph(): MeowdownParagraphExtension {
  return union(
    withPriority(defineMeowdownParagraphSpec(), Priority.highest),
    defineParagraphCommands(),
    defineParagraphKeymap(),
  )
}
