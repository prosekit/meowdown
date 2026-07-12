import type { Slice } from '@prosekit/pm/model'

import type { MarkName } from '../extensions/mark-names.ts'

const CLEAN_TEXT_STRIP_MARK_NAMES: ReadonlySet<MarkName> = new Set<MarkName>([
  'mdMark',
  'mdLinkUri',
  'mdLinkTitle',
])

interface CleanTextOptions {
  /** Keep math delimiters so the projected text remains valid Markdown. */
  preserveMathSource?: boolean
}

/**
 * Projects a document slice to syntax-clean text, omitting inline markers and
 * hidden link destinations. Set `preserveMathSource` when the result must keep
 * complete `$...$` expressions rather than only their formula text.
 */
export function cleanTextFromSlice(slice: Slice, options: CleanTextOptions = {}): string {
  const blocks: string[] = []
  slice.content.forEach((blockNode) => {
    const parts: string[] = []
    blockNode.descendants((textNode) => {
      if (!textNode.isText || !textNode.text) return true
      const textNodeMarks = textNode.marks.map((mark) => mark.type.name as MarkName)
      const stripped =
        textNodeMarks.some((markName) => CLEAN_TEXT_STRIP_MARK_NAMES.has(markName)) &&
        !(options.preserveMathSource && textNodeMarks.includes('mdMath'))
      if (!stripped) parts.push(textNode.text)
      return false
    })
    blocks.push(parts.join(''))
  })
  return blocks.join('\n')
}
