import { collectInlineElements, parseInline } from '../lezer/inline.ts'
import { LEZER_NODE_IDS } from '../lezer/node-ids.ts'

export interface InlineImage {
  from: number
  to: number
  alt: string
  src: string
}

/**
 * Find every `![alt](src)` in a textblock's inline text. Reuses the inline
 * parser, so images inside code spans are skipped.
 */
export function scanInlineImages(text: string): InlineImage[] {
  const out: InlineImage[] = []
  const images = collectInlineElements(
    parseInline(text),
    (node) => node.type === LEZER_NODE_IDS.Image,
  )
  for (const image of images) {
    const url = image.children.find((child) => child.type === LEZER_NODE_IDS.URL)
    const brackets = image.children.filter((child) => child.type === LEZER_NODE_IDS.LinkMark)
    if (!url || brackets.length < 2) continue
    out.push({
      from: image.from,
      to: image.to,
      alt: text.slice(brackets[0].to, brackets[1].from),
      src: text.slice(url.from, url.to),
    })
  }
  return out
}
