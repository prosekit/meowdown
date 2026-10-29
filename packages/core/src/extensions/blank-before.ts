import { defineNodeAttr, union, type Extension } from '@prosekit/core'

import type { NodeName } from './node-names.ts'

type BlankBeforeExtension<Type extends NodeName> = Extension<{
  Nodes: { [Key in Type]: { blankBefore?: boolean | null | undefined } }
}>

function defineBlankBeforeAttr<Type extends NodeName>(type: Type): BlankBeforeExtension<Type> {
  return defineNodeAttr<Type, 'blankBefore', boolean | null>({
    type,
    attr: 'blankBefore',
    default: null,
  })
}

/**
 * Stores whether the Markdown source wrote a block right under the sibling
 * before it, with no blank line between them. `null` leaves the gap to the
 * serializer. List items keep their own attr in `list.ts`. A table has none:
 * ProseKit's attr wrapper reads the `tbody` in its `toDOM` output as an attrs
 * object.
 */
export function defineBlankBeforeAttrs() {
  return union(
    defineBlankBeforeAttr('paragraph'),
    defineBlankBeforeAttr('heading'),
    defineBlankBeforeAttr('blockquote'),
    defineBlankBeforeAttr('codeBlock'),
    defineBlankBeforeAttr('horizontalRule'),
    defineBlankBeforeAttr('htmlComment'),
  )
}
