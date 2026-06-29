# @meowdown/core

The engine powering the editor in [`@meowdown/react`](https://www.npmjs.com/package/@meowdown/react): a hybrid (live-preview) Markdown editor core built on ProseKit and Lezer.

[**Live demo**](https://meowdown.vercel.app/)

## Quick start

```sh
npm install @meowdown/core @prosekit/core
```

Mount an editor into any DOM element, no framework required:

```ts
import '@meowdown/core/style.css'
import { createEditor } from '@prosekit/core'
import { defineEditorExtension, docToMarkdown, markdownToDoc } from '@meowdown/core'

const editor = createEditor({ extension: defineEditorExtension() })
editor.setContent(markdownToDoc('# Hello', { nodes: editor.nodes }))
editor.mount(document.querySelector<HTMLElement>('#editor')!)

// Serialize the current document back to Markdown at any time.
const markdown = docToMarkdown(editor.state.doc)
```

## Supported Markdown features

- CommonMark
  - ATX headings (`# Heading 1`, `## Heading 2`, etc.)
  - Setext headings (`Heading 1\n===`, `Heading 2\n---`)
  - Bullet lists (`- item`, `* item`, `+ item`)
  - Ordered lists (`1. item`, `2) item`, etc.)
  - Blockquotes (`> quote`)
  - Fenced code blocks (` ```lang\ncode\n``` `)
  - Thematic breaks (`---`, `***`, `___`)
  - Bold (`**bold**`), italic (`*italic*`), and inline code
  - Links (`[text](url)`), images (`![alt](src)`), and autolinks (`<https://example.com>`)
  - Hard line breaks
- GitHub Flavored Markdown (GFM)
  - Tables
  - Strikethrough (`~~text~~`)
  - Task lists (`- [ ]`, `- [x]`)
  - Autolinks for `www.`, scheme, and email URLs
- Wikilinks (`[[target]]` and `[[target|alias]]`)
- Highlight (`==highlight==`)
- Tags (`#tag`)
- Bare-domain autolinks (`google.com`, `sub.domain.io/path`)

## Keyboard shortcuts

`Mod` is Cmd on macOS and Ctrl elsewhere. Each formatting shortcut inserts or removes the literal Markdown delimiters around the selection; each heading shortcut toggles the current block to that level (or back to a paragraph).

| Key           | Action                  | Markdown            |
| ------------- | ----------------------- | ------------------- |
| `Mod-B`       | Bold                    | `**bold**`          |
| `Mod-I`       | Italic                  | `*italic*`          |
| `Mod-E`       | Inline code             | `` `code` ``        |
| `Mod-Shift-X` | Strikethrough           | `~~strikethrough~~` |
| `Mod-Shift-H` | Highlight               | `==highlight==`     |
| `Mod-1`       | Heading 1               | `# heading`         |
| `Mod-2`       | Heading 2               | `## heading`        |
| `Mod-3`       | Heading 3               | `### heading`       |
| `Mod-4`       | Heading 4               | `#### heading`      |
| `Mod-5`       | Heading 5               | `##### heading`     |
| `Mod-6`       | Heading 6               | `###### heading`    |
| `Mod-.`       | Fold or unfold a bullet |                     |

`EDITOR_KEY_BINDINGS` is a literal (`as const`) object mapping every key above to its description, for host settings UIs and keybinding-collision checks.

## Round-trip fidelity

`checkRoundTrip(markdown)` reports how faithfully markdown survives a parse-then-serialize round trip: `'exact'` (byte-identical modulo the trailing newline), `'normalizing'` (same non-blank lines, only blank-line layout differs), or `'lossy'` (a non-blank line changed, e.g. a closing ATX hash sequence or unaligned table columns). Hosts that keep markdown on disk can gate saves on it, opening lossy files read-only so a save never rewrites content.

## Styling

`@meowdown/core/style.css` ships a default editor theme. Colors use `light-dark()`, so they follow the page's `color-scheme` (set `color-scheme: light dark` on `:root` for automatic dark mode). Customize by overriding these variables on `:root` or any ancestor:

- `--meowdown-text`: body text color.
- `--meowdown-heading`: heading color.
- `--meowdown-muted`: secondary text (blockquotes).
- `--meowdown-accent`: links, wikilinks, caret, inline code, tags.
- `--meowdown-mark`: Markdown syntax characters.
- `--meowdown-border`: horizontal rules and table borders.
- `--meowdown-code-bg`: code block background.
- `--meowdown-table-header-bg`: table header row background.
- `--meowdown-image-radius`: corner radius of rendered inline images.
- `--meowdown-placeholder`: placeholder text color (defaults to `--meowdown-muted`).
- `--meowdown-font-mono`: monospace font stack.
- `--meowdown-gutter`: horizontal editor padding. Applied to the editable root's `.meowdown-content` class (set by `@meowdown/react`), not `.ProseMirror`, so the block handle's drag preview stays unpadded. Floating UI such as the block handle lives inside it; keep it at least `3.5rem`.
- `--meowdown-selection`: text `::selection` background.
- `--meowdown-node-outline`: outline of a selected node; border color of selected tables and cells.
- `--meowdown-node-selection`: background wash of a selected node or selected cells.

Selection colors are standalone variables, not derived from `--meowdown-accent`, so selection can be restyled independently.

Tags (`#tag`) render as pills via the `.md-tag` class, tinted from `--meowdown-accent`. Wire click handling with `defineTagClickHandler(({ tag, event }) => ...)` (or `@meowdown/react`'s `onTagClick` prop); `tag` is read from the rendered text without the leading `#`.

Wikilinks (`[[target]]`/`[[target|alias]]`) render in place via a mark view as an immutable label (the alias, or the target when there is no alias), with the raw source hidden in hide and focus modes and shown dimmed in show mode. The label uses the `.md-wikilink-label` class and the raw source the `.md-wikilink-source` class, both dashed-underlined and colored by `--meowdown-accent`. In every mark mode the link is a single immutable caret stop: arrowing onto it selects the whole source (ringed with `--meowdown-node-outline` in hide and focus, the native selection over the visible source in show), and Backspace/Delete remove it as a unit. Wire click navigation with `defineWikilinkClickHandler(({ target, event }) => ...)` (or `@meowdown/react`'s `onWikilinkClick` prop).

Markdown links (`[text](url)`) render the label as an `<a href>` with the `.md-link` class, colored by `--meowdown-accent`; the `[`, `]`, and `(url)` syntax dims in show mode and hides in hide and focus modes. Wire click handling with `defineLinkClickHandler(({ href, event }) => ...)` (or `@meowdown/react`'s `onLinkClick` prop).

Bare URLs autolink without `[text](url)` brackets and share the same `.md-link` rendering and click handling: a scheme URL (`https://example.com`), an angle autolink (`<https://example.com>`), a `www.` host (`www.example.com`), an email (`me@example.com`), and a bare domain (`google.com`, `sub.domain.io/path`). Bare domains are matched against a curated list of common TLDs, so file names and prose keep their dots without linkifying (`README.md`, `node.js`, `i.e.` stay plain text); reach for `[text](url)` or `<url>` to link anything off that list. Autolinks are derived live from the text, so editing one re-evaluates it; the caret sitting inside a link never un-links it.

Inline images (`![alt](src)`) stay literal text and render in place via a mark view, with the raw `![alt](src)` hidden in hide and focus modes. Add it with `defineImage({ resolveImageUrl, onImagePaste })` (or `@meowdown/react`'s image props). `resolveImageUrl` is optional and defaults to showing http(s) URLs as-is. Wire click handling with `defineImageClickHandler(({ src, alt, event }) => ...)` (or `@meowdown/react`'s `onImageClick` prop).

Rendered images are resizable: drag the corner handle and the chosen size is written back into the source as a trailing comment, `![alt](src)<!-- {"width":320,"height":240} -->`, which round-trips as plain Markdown. A comment immediately after an image is folded into its mark and drives the image's `width` and `height` attributes, so the box keeps its dimensions before the image loads; any other comment stays literal text.

Pasting a lone tweet or YouTube link can auto-embed it. `defineEmbedPaste()` (or `@meowdown/react`'s `embedPaste` prop) rewrites the pasted link to `![](url)` so it renders as an embed; one undo turns the embed back into the raw link. It is not part of `defineEditorExtension`; add it explicitly.

Pasting rich-text HTML from a browser (a bullet list, **bold**, a link, ...) converts it to Markdown so the formatting survives instead of arriving as plain text. `defineHTMLPaste()` (applied by default in `@meowdown/react`) rewrites the clipboard's `text/html` through the unified (rehype / remark) pipeline and reparses the Markdown with the editor's schema; meowdown's own clipboard (tagged `data-pm-slice`) and any paste landing in a code block are left to the default path. Going the other way, `defineMarkdownCopy()` serializes copied content to Markdown for the clipboard's `text/plain` flavor, so pasting into a plain-text field keeps list markers and block structure. Neither is part of `defineEditorExtension`; add them explicitly.

Pressing Enter at the end of the document's first heading (the title line) can start a fresh empty bullet on the next line instead of a plain paragraph. `defineBulletAfterHeading()` binds this. It is not part of `defineEditorExtension`; add it explicitly.

Pressing ArrowUp on the first visual line or ArrowDown on the last, when the caret can move no further, can notify the host so it can move focus elsewhere (a previous/next note or page). `defineExitBoundaryHandler(({ direction, event }) => ...)` (or `@meowdown/react`'s `onExitBoundary` prop) fires with `direction` (`'up'` or `'down'`) and the original `KeyboardEvent`; return `false` to let the editor handle the key normally. It also fires for a selected node at the edge, and ignores arrows carrying a modifier. It is not part of `defineEditorExtension`; add it explicitly.

## API

See the full API reference [here](https://npmx.dev/package-docs/@meowdown%2Fcore/).

## License

MIT
