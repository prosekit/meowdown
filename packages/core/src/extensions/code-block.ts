import {
  defaultBlockAt,
  defineKeymap,
  defineNodeAttr,
  union,
  type Extension,
  type PlainExtension,
} from '@prosekit/core'
import {
  defineCodeBlock as defineBaseCodeBlock,
  type CodeBlockAttrs,
} from '@prosekit/extensions/code-block'
import { defineTextBlockEnterRule } from '@prosekit/extensions/enter-rule'
import { defineTextBlockInputRule } from '@prosekit/extensions/input-rule'
import { TextSelection, type Command } from '@prosekit/pm/state'

import { parseInteger } from '../utils/parse-integer.ts'

import type { NodeName } from './node-names.ts'

export type CodeBlockFenceStyle = 'tilde' | 'indented' | 'dollar'

export interface MeowdownCodeBlockAttrs extends CodeBlockAttrs {
  /**
   * How the code block was written in the source: a tilde fence (`~~~`), an
   * indented block (four leading spaces), or a `$$` math fence. `null` (the
   * default) is a backtick fence, so a block created in the editor serializes
   * to the canonical form.
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
      return raw === 'tilde' || raw === 'indented' || raw === 'dollar' ? raw : null
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
      const length = parseInteger(node.getAttribute('data-fence-length'))
      return length != null && length > 3 ? length : null
    },
  })
}

function getTildeFenceAttrs(match: RegExpMatchArray): MeowdownCodeBlockAttrs {
  return { language: match[1] || '', fenceStyle: 'tilde' }
}

function defineTildeFenceInputRule(): PlainExtension {
  return defineTextBlockInputRule({
    regex: /^~~~(\S*)\s$/,
    type: 'codeBlock' satisfies NodeName,
    attrs: getTildeFenceAttrs,
  })
}

function defineTildeFenceEnterRule(): PlainExtension {
  return defineTextBlockEnterRule({
    regex: /^~~~(\S*)$/,
    type: 'codeBlock' satisfies NodeName,
    attrs: getTildeFenceAttrs,
  })
}

function defineDollarFenceEnterRule(): PlainExtension {
  return defineTextBlockEnterRule({
    regex: /^\$\$$/,
    type: 'codeBlock' satisfies NodeName,
    attrs: (): MeowdownCodeBlockAttrs => ({ language: 'math', fenceStyle: 'dollar' }),
  })
}

/**
 * With the caret at the end of a code block, move it into the block below when
 * that block is an empty textblock, and into a new default block otherwise.
 */
export const exitCodeBlockAtEnd: Command = (state, dispatch) => {
  const { $head, empty } = state.selection
  const codeBlock = $head.parent
  if (!empty || !codeBlock.type.spec.code || $head.parentOffset !== codeBlock.content.size) {
    return false
  }

  const container = $head.node(-1)
  const indexAfter = $head.indexAfter(-1)
  const after = $head.after()
  const next = container.maybeChild(indexAfter)
  if (next?.isTextblock && !next.type.spec.code && next.content.size === 0) {
    dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, after + 1)).scrollIntoView())
    return true
  }

  const type = defaultBlockAt(container.contentMatchAt(indexAfter))
  const block = type?.createAndFill()
  if (!type || !block || !container.canReplaceWith(indexAfter, indexAfter, type)) {
    return false
  }
  if (dispatch) {
    const tr = state.tr.insert(after, block)
    dispatch(tr.setSelection(TextSelection.create(tr.doc, after + 1)).scrollIntoView())
  }
  return true
}

function defineCodeBlockExitKeymap(): PlainExtension {
  return defineKeymap({ 'Mod-Enter': exitCodeBlockAtEnd })
}

export function defineCodeBlock() {
  return union(
    defineBaseCodeBlock(),
    defineFenceStyleAttr(),
    defineFenceLengthAttr(),
    defineTildeFenceInputRule(),
    defineTildeFenceEnterRule(),
    defineDollarFenceEnterRule(),
    defineCodeBlockExitKeymap(),
  )
}
