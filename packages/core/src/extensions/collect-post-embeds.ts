import {
  gfmParser,
  LEZER_NODE_IDS,
  parseInline,
  type InlineElement,
  type SyntaxNode,
} from '@meowdown/markdown'

import { matchFrontmatter } from '../converters/md-to-pm.ts'

import { resolveLink, scanLinkParts, type LinkChild } from './inline-text-to-mark-chunks.ts'
import { matchPostEmbed, type PostEmbedKind } from './post-embed.ts'
import { parseReferenceDefinition, type ReferenceDefinition } from './reference-links.ts'

/**
 * A post-embed card found in a Markdown document.
 */
export interface PostEmbedReference {
  kind: PostEmbedKind
  /**
   * The image `src` the card passes to its resolver.
   */
  url: string
}

/**
 * Options for {@link collectPostEmbeds}.
 */
export interface CollectPostEmbedsOptions {
  /**
   * Must match the editor's `frontmatter` option.
   */
  frontmatter?: boolean
}

interface ImageSource {
  children: readonly LinkChild[]
  text: string
}

function getSyntaxChildren(node: SyntaxNode): LinkChild[] {
  const children: LinkChild[] = []
  for (let child = node.firstChild; child != null; child = child.nextSibling) {
    children.push({ type: child.type.id, from: child.from, to: child.to })
  }
  return children
}

function collectOutermostImages(nodes: readonly InlineElement[], images: InlineElement[]): void {
  for (const node of nodes) {
    if (node.type === LEZER_NODE_IDS.Image) images.push(node)
    else collectOutermostImages(node.children, images)
  }
}

/**
 * The post-embed cards an editor renders for `markdown`, in document order.
 * Each `url` is what the card passes to `resolveXPost` or
 * `resolveYouTubeVideo`, so a host can load them before mounting the editor.
 */
export function collectPostEmbeds(
  markdown: string,
  options: CollectPostEmbedsOptions = {},
): PostEmbedReference[] {
  const [, frontmatterLength = 0] = options.frontmatter ? matchFrontmatter(markdown) : []
  const text = markdown.slice(frontmatterLength)
  const referenceDefinitions = new Map<string, ReferenceDefinition>()
  const sources: ImageSource[] = []

  gfmParser.parse(text).iterate({
    enter: (node) => {
      switch (node.type.id) {
        case LEZER_NODE_IDS.LinkReference: {
          // FIXME: to collect tweet and youtube, we do not need to handle LEZER_NODE_IDS.LinkReference LEZER_NODE_IDS.HTMLBlock LEZER_NODE_IDS.ProcessingInstructionBlock. We can just handle LEZER_NODE_IDS.Image. Just add a collectImage function under @meowdown/markdown
          const definition = parseReferenceDefinition(text.slice(node.from, node.to))
          if (definition != null && !referenceDefinitions.has(definition.key)) {
            referenceDefinitions.set(definition.key, definition)
          }
          return false
        }
        case LEZER_NODE_IDS.HTMLBlock:
        case LEZER_NODE_IDS.ProcessingInstructionBlock: {
          // `markdownToDoc` keeps these blocks as paragraph text, and the
          // editor parses their inline syntax.
          const raw = text.slice(node.from, node.to)
          const images: InlineElement[] = []
          collectOutermostImages(parseInline(raw), images)
          for (const image of images) sources.push({ children: image.children, text: raw })
          return false
        }
        case LEZER_NODE_IDS.Image:
          sources.push({ children: getSyntaxChildren(node.node), text })
          return false
        default:
          return true
      }
    },
  })

  const embeds: PostEmbedReference[] = []
  for (const source of sources) {
    const parts = scanLinkParts(source.children)
    const url = resolveLink(parts, source.text, { referenceDefinitions })?.href
    if (url == null) continue
    const kind = matchPostEmbed(url)
    if (kind != null) embeds.push({ kind, url })
  }
  return embeds
}
