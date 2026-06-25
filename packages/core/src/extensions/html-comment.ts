import { defineNodeSpec, type Extension } from '@prosekit/core'

import type { NodeName } from './node-names.ts'

export interface MeowdownHtmlCommentAttrs {
  /**
   * The literal markdown comment, including its delimiters, e.g.
   * `<!-- reflect-capture-page-text:start -->`. A multi-line comment keeps its
   * embedded newlines verbatim so the round-trip is lossless.
   */
  content: string
}

type HtmlCommentExtension = Extension<{
  Nodes: { htmlComment: MeowdownHtmlCommentAttrs }
}>

/**
 * A block-level HTML comment (`<!-- ... -->`) as an invisible, atomic node.
 *
 * Markdown is the source of truth, so a comment must survive a round-trip — but
 * a comment is, by definition, not rendered output. Rather than spilling the raw
 * `<!-- ... -->` into a paragraph (where it reads as body text), the parser maps
 * a `CommentBlock` onto this node: the text rides on the `content` attribute and
 * `toDOM` hides it with `display: none`, so it stays in the document and
 * serializes back verbatim while never showing in the editor. Useful for
 * sentinel markers that tools embed around a region of a note.
 *
 * Only block-level comments (a `<!-- ... -->` that owns its line) become this
 * node. An inline comment in the middle of a paragraph is left as literal text,
 * and raw HTML blocks (`<div>…`) stay visible paragraphs — they can carry
 * content a reader expects to see.
 *
 * The node is `atom` (no editable content) and not selectable: it is an opaque,
 * invisible marker the cursor steps over rather than a block the user edits.
 */
export function defineHtmlComment(): HtmlCommentExtension {
  return defineNodeSpec({
    name: 'htmlComment' satisfies NodeName,
    group: 'block',
    atom: true,
    selectable: false,
    attrs: {
      content: { default: '' },
    },
    // Hidden from view, but kept in the DOM so an editor copy/paste or a
    // serialize → re-parse cycle recovers the raw comment from the data attr.
    toDOM: (node) => [
      'div',
      {
        'data-html-comment': (node.attrs as MeowdownHtmlCommentAttrs).content,
        style: 'display: none',
      },
    ],
    parseDOM: [
      {
        tag: 'div[data-html-comment]',
        getAttrs: (dom) => ({
          content: dom.getAttribute('data-html-comment') ?? '',
        }),
      },
    ],
  })
}
