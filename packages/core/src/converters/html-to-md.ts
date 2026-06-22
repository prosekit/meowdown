import { once } from '@ocavue/utils'
import rehypeParse from 'rehype-parse'
import rehypeRemark from 'rehype-remark'
import remarkGfm from 'remark-gfm'
import remarkStringify from 'remark-stringify'
import { unified } from 'unified'



function createProcessor() {
  return unified()
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
}

const getProcessor = once(createProcessor)

/** Convert HTML into Markdown text. */
export function htmlToMarkdown(html: string): string {
  return String(getProcessor().processSync(html))
}
