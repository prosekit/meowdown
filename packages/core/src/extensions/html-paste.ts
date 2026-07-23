import { definePlugin, type PlainExtension } from '@prosekit/core'
import { Plugin, PluginKey } from '@prosekit/pm/state'

import { htmlToMarkdown } from '../converters/html-to-md.ts'
import { markdownToDoc } from '../converters/md-to-pm.ts'

import { getSemanticDOMSerializer } from './clipboard/clipboard-serializer.ts'
import { getNodeBuildersForSchema } from './schema.ts'

const htmlPasteKey = new PluginKey('meowdown-html-paste')

/**
 * meowdown's own clipboard HTML, which must skip the markdown conversion and
 * go to the native `data-md` parse path. Foreign ProseMirror editors also
 * write `data-pm-slice`, so the check needs a meowdown-specific signature:
 * the `data-meowdown` stamp, or (for HTML copied from an older meowdown) the
 * editor DOM's `md-mark` spans next to `data-pm-slice`.
 */
function isMeowdownClipboardHTML(html: string): boolean {
  if (html.includes('data-meowdown')) return true
  return html.includes('data-pm-slice') && html.includes('md-mark')
}

/**
 * Tags that carry no markdown-representable structure beyond line breaks.
 * Clipboard HTML made of only these is styled plain text: code editors (VS
 * Code and friends) wrap each copied source line in colored `div`/`span`s,
 * and browsers wrap prose in `p`s.
 */
const STYLE_ONLY_TAGS = new Set([
  'html',
  'head',
  'body',
  'meta',
  'style',
  'title',
  'div',
  'span',
  'p',
  'br',
  'font',
  'wbr',
])

/**
 * When `html` is styled plain text, return the text it holds with the line
 * structure restored (one line per `div`, a blank line between `p`s, `<br>`
 * as a newline); return `undefined` when the HTML carries real structure
 * (lists, headings, links, emphasis, …).
 *
 * The extracted text is then pasted as markdown *source* instead of being
 * round-tripped through the HTML-to-markdown converter, whose escaping would
 * turn pasted markdown into `\[ ] task`-style noise.
 */
function extractStyledPlainText(html: string): string | undefined {
  const dom = new window.DOMParser().parseFromString(html, 'text/html')
  for (const element of dom.querySelectorAll('*')) {
    if (!STYLE_ONLY_TAGS.has(element.tagName.toLowerCase())) return undefined
  }
  const output: TextOutput = {
    chunks: [],
    hasContent: false,
    trailingNewlines: 0,
  }
  appendNodeText(dom.body, output)
  // Non-breaking spaces are a styling artifact (indentation, spacing) and
  // would defeat markdown's own indentation rules.
  return output.chunks.join('').replaceAll('\u{A0}', ' ')
}

interface TextOutput {
  chunks: string[]
  hasContent: boolean
  trailingNewlines: number
}

/**
 * Pad `output` so it ends with at least `count` newlines, unless it holds no
 * content yet (leading separators would just be trimmed again).
 */
function ensureTrailingNewlines(output: TextOutput, count: number): void {
  if (!output.hasContent || output.trailingNewlines >= count) return
  appendText(output, '\n'.repeat(count - output.trailingNewlines))
}

function appendText(output: TextOutput, text: string): void {
  if (!text) return
  output.chunks.push(text)

  let index = text.length
  while (index > 0 && text.charCodeAt(index - 1) === 10) index--
  if (index === 0) {
    output.trailingNewlines += text.length
  } else {
    output.hasContent = true
    output.trailingNewlines = text.length - index
  }
}

/** Recursive worker of {@link extractStyledPlainText}. */
function appendNodeText(node: Node, output: TextOutput): void {
  if (node.nodeType === Node.TEXT_NODE) {
    appendText(output, node.nodeValue ?? '')
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return

  const tag = (node as Element).tagName
  if (tag === 'BR') {
    appendText(output, '\n')
    return
  }
  if (tag === 'STYLE' || tag === 'TITLE') return
  // A `div` starts a line of its own, a `p` a paragraph of its own.
  const separator = tag === 'DIV' ? 1 : tag === 'P' ? 2 : 0
  if (separator) ensureTrailingNewlines(output, separator)
  for (const child of node.childNodes) appendNodeText(child, output)
  if (separator) ensureTrailingNewlines(output, separator)
}

/**
 * Paste foreign rich-text HTML as meowdown Markdown. Rewrites the clipboard's
 * `text/html` through `transformPastedHTML`: foreign HTML is converted to a
 * Markdown string, reparsed into meowdown nodes (literal source text, no marks),
 * and re-serialized to HTML so ProseMirror's own clipboard parser inserts it with
 * the right open depths. `<strong>bold</strong>` thus lands as the text `**bold**`,
 * which the inline-mark plugin renders. The re-serialized HTML carries `data-md`,
 * so the textblock contents survive the whitespace-collapsing HTML parse.
 */
export function defineHTMLPaste(): PlainExtension {
  return definePlugin(
    new Plugin({
      key: htmlPasteKey,
      props: {
        transformPastedHTML: (html, view) => {
          if (isMeowdownClipboardHTML(html)) return html

          const parent = view.state.selection.$from.parent
          if (!parent.inlineContent || parent.type.spec.code) return html

          // Styled plain text (VS Code line divs, browser prose `p`s) already
          // *is* markdown source; converting it from HTML would escape its
          // punctuation, so paste the extracted text as markdown directly.
          const markdown = extractStyledPlainText(html) ?? htmlToMarkdown(html)
          if (!markdown.trim()) return html

          const nodes = getNodeBuildersForSchema(view.state.schema)
          const doc = markdownToDoc(markdown, { nodes })
          const serializer = getSemanticDOMSerializer(view.state.schema)
          const container = document.createElement('div')
          container.append(serializer.serializeFragment(doc.content))
          return container.innerHTML
        },
      },
    }),
  )
}
