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
import type { Attrs } from '@prosekit/pm/model'

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

type MeowdownParagraphExtension = Union<[ParagraphSpecExtension, ParagraphCommandsExtension]>

export function defineMeowdownParagraph(): MeowdownParagraphExtension {
  return union(
    withPriority(defineMeowdownParagraphSpec(), Priority.highest),
    defineParagraphCommands(),
    defineParagraphKeymap(),
  )
}
