import { LEZER_NODE_IDS } from './node-ids.ts'
import { gfmParser } from './parser.ts'

/**
 * The destinations of the inline `![alt](src)` images in `markdown`, in
 * document order. Reference images are not resolved.
 */
export function collectImages(markdown: string): string[] {
  const sources: string[] = []
  gfmParser.parse(markdown).iterate({
    enter: (node) => {
      if (node.type.id !== LEZER_NODE_IDS.Image) return true
      let linkMarkCount = 0
      for (let child = node.node.firstChild; child != null; child = child.nextSibling) {
        if (child.type.id === LEZER_NODE_IDS.LinkMark) {
          linkMarkCount++
        } else if (linkMarkCount >= 2 && child.type.id === LEZER_NODE_IDS.URL) {
          sources.push(markdown.slice(child.from, child.to))
        }
      }
      return false
    },
  })
  return sources
}
