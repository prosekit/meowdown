# @meowdown/markdown

The [`@lezer/markdown`](https://github.com/lezer-parser/markdown) grammar layer behind [`@meowdown/core`](https://www.npmjs.com/package/@meowdown/core): [GFM](https://github.github.com/gfm/) plus meowdown's inline syntax (wiki links, wiki embeds, hashtags, `==highlight==`, `$math$`, bare autolinks).

```sh
npm install @meowdown/markdown
```

```ts
import { gfmParser } from '@meowdown/markdown'

const tree = gfmParser.parse('Meeting with [[Ada Lovelace|Ada]]')
```

## Exports

- `gfmParser` / `gfmBlockOnlyParser`: the full and block-only Markdown parsers
- `parseInline` / `collectInlineElements`: low-level inline syntax parsing
- `getAutolinkHref`: bare-domain autolink matching against the TLD allowlist
- `LEZER_NODE_IDS`: the node id table shared with `@meowdown/core`

## Block AST

`parseMarkdownAst` and `serializeMarkdownAst` work in Node or the browser without
ProseMirror, an editor, or a DOM. They use the same block parsing and serialization
rules as the editor's `markdownToDoc` and `docToMarkdown`.

```ts
import { parseMarkdownAst, serializeMarkdownAst } from '@meowdown/markdown'

const document = parseMarkdownAst(
  '+ [ ] **buy** milk\n\n  > Remember the discount\n\n  - [ ] Check stock\n',
)
const item = document.children[0]
if (item.type === 'listItem') {
  item.checked = true
  const firstParagraph = item.children[0]
  if (firstParagraph.type === 'paragraph') {
    firstParagraph.value = '**buy** bread'
  }
}
const markdown = serializeMarkdownAst(document)
// + [x] **buy** bread
//
//   > Remember the discount
//
//   - [ ] Check stock
```

The discriminated `MarkdownNode` union covers documents, paragraphs, headings,
blockquotes, list items, code/math blocks, thematic breaks, HTML comments, and
tables with rows and cells. Inline `value` strings retain literal Markdown such as
`**bold**`, `_italic_`, links, and soft line breaks. They are not rendered text or
an inline formatting tree. Raw HTML and reference definitions remain paragraphs.

A `listItem` represents one item. Adjacent siblings form a list run; nested items
live in `children`. Items can contain multiple blocks, and their first block need
not be a paragraph. Formatting fields retain marker spelling, checkbox case,
marker spacing, heading style, code fences, and table alignment. Optional fields
use `undefined` for the default spelling. Leading, trailing, and repeated blank
lines use empty paragraphs.

Pass `{ frontmatter: true }` to both functions to read/write YAML frontmatter.
The document's `frontmatter` is the body without fences; `undefined` means absent
and `''` means an empty frontmatter block.

Every block, table row, and table cell from `parseMarkdownAst` carries a
`position`: `{ from, to }` offsets into the source string, frontmatter counted.
`\r\n` and `\r` are read as `\n`, and the offsets index the text with `\n` line
endings. The range covers the node's own syntax (list
markers, `#`, fences); a blank line is an empty paragraph whose `from` and `to`
both sit at the end of that line. Positions describe one parse of one string:
editing a `value` or the tree does not move them, and nodes built by hand or by
the editor have none.

`isMarkdownAstEqual(a, b)` tells whether two trees hold the same nodes and fields.
It does not compare `position`.

The serializer normalizes the whole document using existing editor rules. It is
**not a lossless source printer**: it can normalize whitespace, indentation, fence
widths, and table layout. The AST provides no stable item IDs.

The editor adapters are internal persistence projections, not a way to preserve
arbitrary ProseMirror marks and extension nodes. They can attach `segments` to raw
inline values to retain text-boundary-sensitive continuation behavior. Changing a
value invalidates those recorded segments. Unsupported editor blocks use `ignored`
nodes, which emit nothing but keep list-run boundaries; standalone editor text uses
`text`. The Markdown parser itself produces neither type.

## Structural editing

`walkMarkdownAst(document)` yields `{ node, parent, index, path }` in depth-first
order, including the root at `[]`. `resolveMarkdownAstPath(document, path)` returns
the same shape or `undefined` for an invalid address. Paths count every child,
including paragraphs and table cells. They belong to one document revision, not
to a persistent identity. Resolve every target before changing sibling arrays;
then edit node references and traverse again to obtain the new paths.

## Round-trip fidelity

`checkRoundTrip(markdown)` reports how faithfully Markdown survives a
parse-then-serialize round trip: `'exact'`, `'normalizing'`, or `'lossy'`.
