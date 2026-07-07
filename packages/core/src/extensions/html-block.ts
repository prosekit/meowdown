import { defineNodeSpec, type Extension } from '@prosekit/core'
import type { Attrs } from '@prosekit/pm/model'

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
export function defineHTMLBlock(): HTMLBlockExtension {
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
