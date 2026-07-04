import { defineNodeAttr, union, type Extension } from '@prosekit/core'
import {
  defineCodeBlock as defineBaseCodeBlock,
  type CodeBlockAttrs,
} from '@prosekit/extensions/code-block'

import type { NodeName } from './node-names.ts'

export type CodeBlockFenceStyle = 'tilde' | 'indented'

export interface MeowdownCodeBlockAttrs extends CodeBlockAttrs {
  /**
   * How the code block was written in the source: a tilde fence (`~~~`) or an
   * indented block (four leading spaces). `null` (the default) is a backtick
   * fence, so a block created in the editor serializes to the canonical form.
   */
  fenceStyle?: CodeBlockFenceStyle | null

  /**
   * The number of characters in the opening fence, kept only when it exceeds
   * CommonMark's three-character minimum. `null` (the default) lets the
   * serializer pick the shortest fence the content allows.
   */
  fenceLength?: number | null
}

type FenceStyleExtension = Extension<{
  Nodes: { codeBlock: { fenceStyle?: CodeBlockFenceStyle | null } }
}>

function defineFenceStyleAttr(): FenceStyleExtension {
  return defineNodeAttr<'codeBlock', 'fenceStyle', CodeBlockFenceStyle | null>({
    type: 'codeBlock' satisfies NodeName,
    attr: 'fenceStyle',
    default: null,
    // Only a parsed tilde fence or indented block carries a style; it must
    // survive an editor DOM re-parse.
    toDOM: (value) => (value != null ? ['data-fence-style', value] : null),
    parseDOM: (node) => {
      const raw = node.getAttribute('data-fence-style')
      return raw === 'tilde' || raw === 'indented' ? raw : null
    },
  })
}

type FenceLengthExtension = Extension<{
  Nodes: { codeBlock: { fenceLength?: number | null } }
}>

function defineFenceLengthAttr(): FenceLengthExtension {
  return defineNodeAttr<'codeBlock', 'fenceLength', number | null>({
    type: 'codeBlock' satisfies NodeName,
    attr: 'fenceLength',
    default: null,
    // Only a parsed fence longer than three characters carries a length; it
    // must survive an editor DOM re-parse.
    toDOM: (value) => (value != null ? ['data-fence-length', String(value)] : null),
    parseDOM: (node) => {
      const raw = node.getAttribute('data-fence-length')
      if (raw == null) return null
      const length = Number.parseInt(raw, 10)
      return Number.isSafeInteger(length) && length > 3 ? length : null
    },
  })
}

export function defineCodeBlock() {
  return union(defineBaseCodeBlock(), defineFenceStyleAttr(), defineFenceLengthAttr())
}
