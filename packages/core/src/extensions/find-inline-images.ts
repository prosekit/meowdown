import type { InlineElement } from '../lezer/inline.ts'
import { collectInlineElements, parseInline } from '../lezer/inline.ts'
import { LEZER_NODE_IDS } from '../lezer/node-ids.ts'

/** One `![alt](src)` occurrence, offsets relative to the block text. */
export interface InlineImage {
  from: number
  to: number
  alt: string
  src: string
}

/** Every renderable image in one textblock's inline text, in document order. */
export function findInlineImages(text: string): InlineImage[] {
  const out: InlineImage[] = []
  const nodes = collectInlineElements(parseInline(text), isImage)
  for (const node of nodes) {
    const image = imageFromNode(node, text)
    if (image) out.push(image)
  }
  return out
}

function isImage(node: InlineElement): boolean {
  return node.type === LEZER_NODE_IDS.Image
}

function imageFromNode(node: InlineElement, text: string): InlineImage | null {
  // Lezer children: LinkMark `![`, label..., LinkMark `]`, LinkMark `(`, URL, LinkMark `)`.
  let labelFrom = -1
  let labelTo = -1
  let markCount = 0
  let urlNode: InlineElement | null = null
  for (const child of node.children) {
    if (child.type === LEZER_NODE_IDS.LinkMark) {
      markCount++
      if (markCount === 1) labelFrom = child.to
      if (markCount === 2) labelTo = child.from
    } else if (child.type === LEZER_NODE_IDS.URL && urlNode === null) {
      urlNode = child
    }
  }
  if (!urlNode || labelFrom < 0 || labelTo < labelFrom) return null
  const src = text.slice(urlNode.from, urlNode.to)
  if (!src) return null
  return { from: node.from, to: node.to, alt: text.slice(labelFrom, labelTo), src }
}
