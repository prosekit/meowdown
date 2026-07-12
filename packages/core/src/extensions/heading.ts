import {
  defineKeymap,
  defineNodeAttr,
  defineNodeSpec,
  isAtBlockStart,
  toggleNode,
  union,
  unsetBlockType,
  withSkipCodeBlock,
  type Extension,
  type PlainExtension,
} from '@prosekit/core'
import {
  defineHeadingCommands,
  defineHeadingInputRule,
  defineHeadingSpec,
  type HeadingAttrs,
} from '@prosekit/extensions/heading'
import type { ProseMirrorNode, TagParseRule } from '@prosekit/pm/model'
import type { Command } from '@prosekit/pm/state'

import { semanticTextblockDOM, sourceTextRule } from './clipboard/semantic-inline.ts'
import type { NodeName } from './node-names.ts'

export interface MeowdownHeadingAttrs extends HeadingAttrs {
  /**
   * For a setext heading, the number of underline characters (`=` for level 1,
   * `-` for level 2) that followed the text in the source. CommonMark allows
   * any underline length, so keeping the count makes the round-trip lossless.
   * `null` (the default) marks an ATX heading (`# foo`); only levels 1 and 2
   * can be setext, and the level alone decides the underline character.
   */
  setextUnderline?: number | null

  /**
   * For an ATX heading written with a closing `#` sequence (`# foo #`), the
   * number of `#` characters in that closing run, so the round-trip is lossless.
   * The opening and closing runs may differ in length, so the count is kept on
   * its own. `null` (the default) means the heading had no closing sequence.
   */
  closingHashes?: number | null
}

type HeadingSpecExtension = Extension<{
  Nodes: { heading: HeadingAttrs }
}>

/**
 * Merge `whitespace: 'pre'` onto the base heading spec. A multi-line setext
 * heading keeps a soft line break as a literal `\n`; without `whitespace: 'pre'`
 * (and `white-space: pre-wrap` in the stylesheet) a DOM re-read folds it to a
 * space, dropping the break. `defineNodeSpec` merges specs of the same name, so
 * this adds the single field without re-declaring the heading spec.
 */
function defineHeadingWhitespace(): HeadingSpecExtension {
  return defineNodeSpec({ name: 'heading' satisfies NodeName, whitespace: 'pre' })
}

// REVIEW: move this to a shared utils file, since it doesn't depend on headings at all. It's a general parse helper.
// The input argument should be string|null|undefined. The output return should be number|undefined.
// There should be a parseSafeInteger and parseSavePositiveInteger two functions
function parsePositiveCount(raw: string | null): number | null {
  if (raw == null) return null
  const count = Number.parseInt(raw, 10)
  return Number.isSafeInteger(count) && count > 0 ? count : null
}

/** The clipboard DOM of a heading: semantic inline content plus `data-md`. */
export function headingClipboardDOM(node: ProseMirrorNode): HTMLElement {
  const attrs = node.attrs as MeowdownHeadingAttrs
  return semanticTextblockDOM(`h${attrs.level}`, node, {
    'data-setext-underline':
      attrs.setextUnderline != null ? String(attrs.setextUnderline) : undefined,
    'data-closing-hashes': attrs.closingHashes != null ? String(attrs.closingHashes) : undefined,
  })
}

/** The clipboard parse rules restoring a heading's source text from `data-md`. */
export function headingFromDOM(): TagParseRule[] {
  return [1, 2, 3, 4, 5, 6].map((level) =>
    sourceTextRule(`h${level}`, 'heading' satisfies NodeName, (dom) => ({
      level,
      setextUnderline: parsePositiveCount(dom.getAttribute('data-setext-underline')),
      closingHashes: parsePositiveCount(dom.getAttribute('data-closing-hashes')),
    })),
  )
}

type SetextUnderlineExtension = Extension<{
  Nodes: { heading: { setextUnderline?: number | null } }
}>

function defineSetextUnderlineAttr(): SetextUnderlineExtension {
  return defineNodeAttr<'heading', 'setextUnderline', number | null>({
    type: 'heading' satisfies NodeName,
    attr: 'setextUnderline',
    default: null,
    // A heading split or created in the editor is ATX; only a parsed setext
    // heading carries a length, which must survive an editor DOM re-parse.
    toDOM: (value) => (value != null ? ['data-setext-underline', String(value)] : null),
    parseDOM: (node) => parsePositiveCount(node.getAttribute('data-setext-underline')),
  })
}

type ClosingHashesExtension = Extension<{
  Nodes: { heading: { closingHashes?: number | null } }
}>

function defineHeadingClosingHashesAttr(): ClosingHashesExtension {
  return defineNodeAttr<'heading', 'closingHashes', number | null>({
    type: 'heading' satisfies NodeName,
    attr: 'closingHashes',
    default: null,
    // Only a parsed ATX heading with a closing `#` run carries a count; a heading
    // created or edited in the editor has none, and the count must survive a DOM
    // re-parse.
    toDOM: (value) => (value != null ? ['data-closing-hashes', String(value)] : null),
    parseDOM: (node) => parsePositiveCount(node.getAttribute('data-closing-hashes')),
  })
}

function toggleHeading(level: number): Command {
  return withSkipCodeBlock(toggleNode({ type: 'heading' satisfies NodeName, attrs: { level } }))
}

const backspaceUnsetHeading: Command = (state, dispatch, view) => {
  const $pos = isAtBlockStart(state, view)
  if ($pos?.parent.type.name === ('heading' satisfies NodeName)) {
    return unsetBlockType()(state, dispatch, view)
  }
  return false
}

function defineHeadingKeymap(): PlainExtension {
  return defineKeymap({
    'Mod-1': toggleHeading(1),
    'Mod-2': toggleHeading(2),
    'Mod-3': toggleHeading(3),
    'Mod-4': toggleHeading(4),
    'Mod-5': toggleHeading(5),
    'Mod-6': toggleHeading(6),
    Backspace: backspaceUnsetHeading,
  })
}

export function defineHeading() {
  return union(
    defineHeadingSpec(),
    defineHeadingWhitespace(),
    defineSetextUnderlineAttr(),
    defineHeadingClosingHashesAttr(),
    defineHeadingInputRule(),
    defineHeadingCommands(),
    defineHeadingKeymap(),
  )
}
