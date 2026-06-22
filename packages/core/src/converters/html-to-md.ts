import rehypeParse from 'rehype-parse'
import rehypeRemark from 'rehype-remark'
import remarkGfm from 'remark-gfm'
import remarkStringify from 'remark-stringify'
import { unified } from 'unified'

// Built once. The `remark-stringify` options pin meowdown's canonical dialect so
// the output matches what the serializer (`pm-to-md.ts`) would emit: `-` bullets,
// single-`*` emphasis, `**` strong, fenced code, and `---` thematic breaks.
const processor = unified()
  .use(rehypeParse)
  .use(rehypeRemark)
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
  })
  .freeze()

/** Convert clipboard HTML into meowdown-dialect Markdown text. */
export function htmlToMarkdown(html: string): string {
  return String(processor.processSync(html))
}
