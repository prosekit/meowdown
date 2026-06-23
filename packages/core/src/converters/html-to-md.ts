import { once } from '@ocavue/utils'
import type { Handle as HastToMdastHandle } from 'hast-util-to-mdast'
import type { Parent, PhrasingContent } from 'mdast'
import type { Handle as MdastToMarkdownHandle } from 'mdast-util-to-markdown'
import rehypeParse from 'rehype-parse'
import rehypeRemark from 'rehype-remark'
import remarkGfm from 'remark-gfm'
import remarkStringify from 'remark-stringify'
import { unified } from 'unified'

/**
 * Inline highlight node for `==text==`. Standard mdast has no such node, so it
 * is registered here and serialized by `highlightToMarkdown`.
 */
interface Highlight extends Parent {
  type: 'highlight'
  children: PhrasingContent[]
}

declare module 'mdast' {
  interface PhrasingContentMap {
    highlight: Highlight
  }
  interface RootContentMap {
    highlight: Highlight
  }
}

/**
 * Convert a `<mark>` element into a `highlight` node. There is no built-in
 * `hast-util-to-mdast` handler for `<mark>`, so without this the highlight is
 * dropped and only its text survives.
 */
const markToHighlight: HastToMdastHandle = (state, element) => {
  const result: Highlight = {
    type: 'highlight',
    children: state.all(element) as PhrasingContent[],
  }
  state.patch(element, result)
  return result
}

/**
 * Serialize a `highlight` node as `==text==`. The `==` delimiters are written
 * through the construct machinery (not as plain text) so they are never
 * escaped: a leading `=` written as text would otherwise become `\=` to guard
 * against a setext heading underline. Mirrors `mdast-util-gfm-strikethrough`.
 */
const highlightToMarkdown: MdastToMarkdownHandle = (node, _parent, state, info) => {
  const highlight = node as Highlight
  const tracker = state.createTracker(info)
  let value = tracker.move('==')
  value += tracker.move(
    state.containerPhrasing(highlight, { ...tracker.current(), before: value, after: '=' }),
  )
  value += tracker.move('==')
  return value
}

function createProcessor() {
  return unified()
    .use(rehypeParse)
    .use(rehypeRemark, { handlers: { mark: markToHighlight } })
    .use(remarkGfm)
    .use(remarkStringify, {
      bullet: '-',
      emphasis: '*',
      strong: '*',
      fence: '`',
      fences: true,
      rule: '-',
      ruleRepetition: 3,
      listItemIndent: 'one',
      handlers: { highlight: highlightToMarkdown },
    })
    .freeze()
}

const getProcessor = once(createProcessor)

/** Convert HTML into Markdown text. */
export function htmlToMarkdown(html: string): string {
  return String(getProcessor().processSync(html))
}
