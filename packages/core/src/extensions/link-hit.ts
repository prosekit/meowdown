import type { EditorState } from '@prosekit/pm/state'

import { collectInlineElements, parseInline } from '../lezer/inline.ts'
import { LEZER_NODE_IDS } from '../lezer/node-ids.ts'

/** A resolved wikilink under a document position. */
export interface WikilinkHit {
  /** Document position of the opening `[[`. */
  from: number
  /** Document position just after the closing `]]`. */
  to: number
  /** Target before the first `|`, trimmed. Empty links never produce a hit. */
  target: string
  /** Display text after the first `|`, trimmed; equals `target` when no `|`. */
  display: string
  /** Raw text between the brackets (`target|display`). */
  raw: string
}

/** A resolved Markdown link under a document position. */
export interface LinkHit {
  /** Document position of the start of the link text. */
  from: number
  /** Document position of the end of the link text. */
  to: number
  /** The link URL (the `mdLinkText` href attribute). */
  href: string
  /** The visible link text. */
  text: string
}

/**
 * Resolves the wikilink whose `[[...]]` spans `pos`, or `null`. Uses the same
 * Lezer inline parser that applies the `mdWikilink` mark, so hit detection can
 * never disagree with rendering. Returns `null` inside code blocks, inside
 * blocks with non-text inline content (the offset mapping assumes all text),
 * outside any wikilink, or when the target is empty after trimming.
 */
export function wikilinkAt(state: EditorState, pos: number): WikilinkHit | null {
  const $pos = state.doc.resolve(pos)
  const block = $pos.parent
  if (!block.isTextblock || block.type.spec.code) return null

  let allText = true
  block.forEach((child) => {
    if (!child.isText) allText = false
  })
  if (!allText) return null

  const blockStart = $pos.start()
  const offset = pos - blockStart
  const text = block.textContent

  const elements = collectInlineElements(
    parseInline(text),
    (node) => node.type === LEZER_NODE_IDS.Wikilink,
  )
  const hit = elements.find((element) => offset >= element.from && offset < element.to)
  if (!hit) return null

  const raw = text.slice(hit.from + 2, hit.to - 2)
  const pipe = raw.indexOf('|')
  const target = (pipe >= 0 ? raw.slice(0, pipe) : raw).trim()
  const display = (pipe >= 0 ? raw.slice(pipe + 1) : raw).trim()
  if (!target) return null

  return { from: blockStart + hit.from, to: blockStart + hit.to, target, display, raw }
}

/**
 * Resolves the Markdown link whose `[text](url)` spans `pos`, or `null`. Uses
 * the same Lezer inline parser that applies the `mdLinkText` mark. The returned
 * `from`/`to` span only the link's visible label (not the brackets or URL).
 * Returns `null` inside code blocks, inside blocks with non-text inline
 * content, off any link, or when the URL is empty. Images (`![alt](url)`) are
 * not links and never match.
 */
export function linkAt(state: EditorState, pos: number): LinkHit | null {
  const $pos = state.doc.resolve(pos)
  const block = $pos.parent
  if (!block.isTextblock || block.type.spec.code) return null

  let allText = true
  block.forEach((child) => {
    if (!child.isText) allText = false
  })
  if (!allText) return null

  const blockStart = $pos.start()
  const offset = pos - blockStart
  const text = block.textContent

  const links = collectInlineElements(
    parseInline(text),
    (node) => node.type === LEZER_NODE_IDS.Link,
  )
  for (const link of links) {
    if (offset < link.from || offset >= link.to) continue

    let labelStart = -1
    let labelEnd = -1
    let bracketCount = 0
    let url: { from: number; to: number } | null = null
    for (const child of link.children) {
      if (child.type === LEZER_NODE_IDS.LinkMark) {
        bracketCount++
        if (bracketCount === 1) labelStart = child.to
        else if (bracketCount === 2) labelEnd = child.from
      } else if (child.type === LEZER_NODE_IDS.URL && !url) {
        url = child
      }
    }
    if (labelStart < 0 || labelEnd < 0) continue

    const href = url ? text.slice(url.from, url.to) : ''
    if (!href) return null

    return {
      from: blockStart + labelStart,
      to: blockStart + labelEnd,
      href,
      text: text.slice(labelStart, labelEnd),
    }
  }
  return null
}
