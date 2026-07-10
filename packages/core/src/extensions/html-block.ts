import { defineNodeSpec, getNodeType, union, type Extension } from '@prosekit/core'
import { defineEnterRule } from '@prosekit/extensions/enter-rule'
import type { Attrs } from '@prosekit/pm/model'
import { TextSelection } from '@prosekit/pm/state'

import type { NodeName } from './node-names.ts'

/**
 * What a raw HTML block is, derived from its opening characters. Only an
 * `element` block can produce visible output, so only it gets a rendered
 * preview; every other kind stays as always-visible source.
 */
export type HTMLBlockKind =
  | 'element'
  | 'comment'
  | 'instruction'
  | 'declaration'
  | 'cdata'
  | 'metadata'

/**
 * Classify a raw HTML block's source. The boundaries follow the CommonMark
 * HTML block start conditions as `@lezer/markdown` implements them (spec 0.30:
 * `<textarea>` is not part of the script/pre/style group), so the editor and
 * the parser always agree on what a block is.
 */
export function getHTMLBlockKind(source: string): HTMLBlockKind {
  const start = source.trimStart()
  if (start.startsWith('<!--')) return 'comment'
  if (start.startsWith('<![CDATA[')) return 'cdata'
  if (/^<![A-Z]/i.test(start)) return 'declaration'
  if (start.startsWith('<?')) return 'instruction'
  if (/^<(?:script|style)(?:[\s>]|$)/i.test(start)) return 'metadata'
  return 'element'
}

/**
 * The seven CommonMark HTML block start conditions, in spec order, as
 * `@lezer/markdown` spells them (spec 0.30: `<textarea>` is not in the type-1
 * group and the type-6 tag list is 0.30's). Keeping these identical to the
 * parser's is what lets the enter rule agree with a later reparse. `line` must
 * already have its leading indentation removed.
 */
const HTML_BLOCK_STARTS: readonly RegExp[] = [
  /^<(?:script|pre|style)(?:\s|>|$)/i,
  /^<!--/,
  /^<\?/,
  /^<![A-Z]/i,
  /^<!\[CDATA\[/,
  /^<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|section|source|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|\/?>|$)/i,
  /^(?:<\/[a-z][\w-]*\s*>|<[a-z][\w-]*(?:\s+[a-z:_][\w.-]*(?:\s*=\s*(?:[^\s"'=<>`]+|'[^']*'|"[^"]*"))?)*\s*\/?>)\s*$/i,
]

/**
 * The inline end condition for each start type. Types 1-5 close on the same
 * line when this matches; types 6-7 (undefined) only close at a blank line, so
 * they never complete inline.
 */
const HTML_BLOCK_INLINE_ENDS: ReadonlyArray<RegExp | undefined> = [
  /<\/(?:script|pre|style)>/i,
  /-->/,
  /\?>/,
  />/,
  /\]\]>/,
  undefined,
  undefined,
]

/** The matched start type (0-6) of an HTML block line, or -1 for none. */
function matchHTMLBlockStart(line: string): number {
  return HTML_BLOCK_STARTS.findIndex((regex) => regex.test(line))
}

/** Strip up to three leading spaces (CommonMark's HTML block indentation). */
function stripBlockIndent(line: string): string {
  const match = /^ {0,3}/.exec(line)
  return match ? line.slice(match[0].length) : line
}

type HTMLBlockExtension = Extension<{
  Nodes: { htmlBlock: Attrs }
}>

/**
 * A raw HTML block (CommonMark 4.6), including HTML comments and processing
 * instructions. The node's text content is the literal markdown source, so a
 * round trip is byte-exact. `code: true` keeps the inline-mark plugin from
 * parsing markdown inside it (CommonMark suppresses inline parsing in raw
 * HTML) and enrolls it in the shared code-block behaviors: the caret-inside
 * preview decoration and the trailing-blank-line Enter exit.
 */
function defineHTMLBlockSpec(): HTMLBlockExtension {
  return defineNodeSpec({
    name: 'htmlBlock' satisfies NodeName,
    content: 'text*',
    group: 'block',
    code: true,
    defining: true,
    marks: '',
    parseDOM: [
      // `codeBlock` claims every bare `pre`; outrank it for the tagged form.
      { tag: 'pre[data-html-block]', preserveWhitespace: 'full', priority: 100 },
    ],
    toDOM: () => ['pre', { 'data-html-block': '' }, ['code', 0]],
  })
}

/**
 * Turn a single-line paragraph into an `htmlBlock` when Enter is pressed at its
 * end and the line begins a CommonMark HTML block (`<div>`, `<!-- ... -->`,
 * `<?php ... ?>`, ...). Unlike a fenced code block, the start line is content,
 * so it is kept, not deleted. A block whose start line already closes inline
 * (types 1-5, e.g. `<!-- x -->`) drops the caret into a fresh paragraph after
 * it; an open block (types 6-7, or an unterminated 1-5) keeps the caret inside
 * on a new line so the user can fill it in.
 */
function defineHTMLBlockEnterRule() {
  return defineEnterRule({
    // Broad gate: any single line that starts with `<`. The handler runs the
    // precise start conditions, so an autolink like `<https://x>` is declined.
    regex: /^ {0,3}<[^\n]*$/,
    handler: ({ state }) => {
      const { selection } = state
      if (!selection.empty) return null
      const { $head } = selection
      const parent = $head.parent
      if (parent.type.name !== ('paragraph' satisfies NodeName)) return null
      // Only a single-line paragraph, with the caret at its very end.
      if ($head.parentOffset !== parent.content.size) return null
      const line = parent.textContent
      if (line.includes('\n')) return null

      const stripped = stripBlockIndent(line)
      const startType = matchHTMLBlockStart(stripped)
      if (startType < 0) return null

      const htmlBlockType = getNodeType(state.schema, 'htmlBlock' satisfies NodeName)
      if (!$head.node(-1).canReplaceWith($head.index(-1), $head.indexAfter(-1), htmlBlockType)) {
        return null
      }

      const inlineEnd = HTML_BLOCK_INLINE_ENDS[startType]
      const closedInline = inlineEnd ? inlineEnd.test(stripped) : false

      const tr = state.tr
      tr.setBlockType($head.pos, $head.pos, htmlBlockType)

      if (closedInline) {
        // A complete block: continue in a fresh paragraph after it.
        const paragraphType = getNodeType(state.schema, 'paragraph' satisfies NodeName)
        const afterBlock = tr.mapping.map($head.after())
        const paragraph = paragraphType.createAndFill()
        if (!paragraph) return null
        tr.insert(afterBlock, paragraph)
        tr.setSelection(TextSelection.create(tr.doc, afterBlock + 1))
      } else {
        // An open block: keep filling it in on a new line inside.
        const endOfContent = tr.mapping.map($head.pos)
        tr.insertText('\n', endOfContent)
        tr.setSelection(TextSelection.create(tr.doc, endOfContent + 1))
      }

      return tr.scrollIntoView()
    },
    stop: true,
  })
}

/**
 * Adds the `htmlBlock` node and the enter rule that creates one from an HTML
 * start line.
 */
export function defineHTMLBlock() {
  return union(defineHTMLBlockSpec(), defineHTMLBlockEnterRule())
}
