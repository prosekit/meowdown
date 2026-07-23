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
  - Fenced code blocks (` ```lang\ncode\n``` `), keeping tilde fences (`~~~`) and fence lengths through a round-trip
  - Indented code blocks (four leading spaces)
  - Thematic breaks (`---`, `***`, `___`)
  - Bold (`**bold**`), italic (`*italic*`), and inline code
  - Links (`[text](url)`), images (`![alt](src)`), and autolinks (`<https://example.com>`)
  - Hard line breaks
- GitHub Flavored Markdown (GFM)
  - Tables, including column alignment (`:--`, `:-:`, `--:`)
  - Strikethrough (`~~text~~`)
  - Task lists (`- [ ]`, `- [x]`)
  - Autolinks for `www.`, scheme, and email URLs
- Wikilinks (`[[target]]` and `[[target|alias]]`)
- Highlight (`==highlight==`)
- Tags (`#tag`)
- Bare-domain autolinks (`google.com`, `sub.domain.io/path`)
- Math, compiled by KaTeX to native MathML (no stylesheet or fonts needed)
  - Inline math (`$x$` and `$$x$$`), Pandoc-style delimiter rules so `$20,000 and $30,000` stays plain text
  - Display math (`$$` fences on their own lines), kept as `$$` through a round-trip
  - ` ```math ` fenced code blocks

## Keyboard shortcuts

`Mod` is Cmd on macOS and Ctrl elsewhere. Each formatting shortcut inserts or removes the literal Markdown delimiters around the selection; each heading shortcut toggles the current block to that level (or back to a paragraph).

| Key                    | Action                                                    | Markdown            |
| ---------------------- | --------------------------------------------------------- | ------------------- |
| `Mod-B`                | Bold                                                      | `**bold**`          |
| `Mod-I`                | Italic                                                    | `*italic*`          |
| `Mod-E`                | Inline code                                               | `` `code` ``        |
| `Mod-Shift-X`          | Strikethrough                                             | `~~strikethrough~~` |
| `Mod-Shift-H`          | Highlight                                                 | `==highlight==`     |
| `Mod-K`                | Link                                                      | `[text](url)`       |
| `Mod-Shift-K`          | Insert a wikilink                                         | `[[target]]`        |
| `Mod-1`                | Heading 1                                                 | `# heading`         |
| `Mod-2`                | Heading 2                                                 | `## heading`        |
| `Mod-3`                | Heading 3                                                 | `### heading`       |
| `Mod-4`                | Heading 4                                                 | `#### heading`      |
| `Mod-5`                | Heading 5                                                 | `##### heading`     |
| `Mod-6`                | Heading 6                                                 | `###### heading`    |
| `Mod-.`                | Fold or unfold a bullet                                   |                     |
| `Mod-Enter`            | Follow the link under the caret, or cycle a checkbox task | `- [ ]` / `- [x]`   |
| `Mod-Shift-Enter`      | Cycle a circle checkbox task                              | `+ [ ]` / `+ [x]`   |
| `Mod-Shift-7`          | Ordered list                                              | `1. item`           |
| `Mod-Shift-8`          | Bullet list                                               | `- item`            |
| `Mod-Shift-9`          | Checkbox task list                                        | `- [ ] item`        |
| `Alt-ArrowUp`          | Move the block or list item up                            |                     |
| `Alt-ArrowDown`        | Move the block or list item down                          |                     |
| `Meta-ArrowUp`         | Move the caret to the document start                      |                     |
| `Meta-ArrowDown`       | Move the caret to the document end                        |                     |
| `Shift-Meta-ArrowUp`   | Select to the document start                              |                     |
| `Shift-Meta-ArrowDown` | Select to the document end                                |                     |
| `Escape`               | Collapse the selection                                    |                     |

The list-type toggles wrap the current block, convert a list of a different kind in place, and unwrap a list of the same kind back to a paragraph. `Mod-Shift-7/8/9` follow the physical digit key, so they work on layouts where Shift+digit types punctuation. `Alt-ArrowUp`/`Alt-ArrowDown` move a list item together with its nested children, or swap a non-list block with its neighbor. The `Meta-Arrow` document-boundary motions (Cmd on macOS) are bound explicitly because browsers do not reliably perform the native move (WebKit gives up when the document starts with a list marker). Typing `[` over a selection wraps it into an open wikilink (`[[selection`) with the wikilink menu searching it.

`EDITOR_KEY_BINDINGS` is a literal (`as const`) object mapping every key above to its description, for host settings UIs and keybinding-collision checks.

## Round-trip fidelity

[`checkRoundTrip(markdown)`](https://npmx.dev/package-docs/@meowdown%2Fcore#function-checkRoundTrip) reports how faithfully markdown survives a parse-then-serialize round trip: `'exact'`, `'normalizing'`, or `'lossy'`. Hosts that keep markdown on disk can gate saves on it, opening lossy files read-only so a save never rewrites content.

## Styling

`@meowdown/core/style.css` ships a default editor theme. Colors use `light-dark()`, so they follow the page's `color-scheme` (set `color-scheme: light dark` on `:root` for automatic dark mode). Theme it by overriding the `--meowdown-*` variables on `:root` or any ancestor. The full list, with a one-line description and default for each, lives in the commented `:root` block at the top of [`style.css`](./src/style.css), which is the single source of truth.

meowdown's CSS is wrapped in a cascade layer, `@layer meowdown` (with sub-layers `meowdown.base` for the bundled ProseMirror / prosekit base styles, `meowdown.theme` for the variables, and `meowdown.editor` for the editor rules). Because an un-layered rule always beats a layered one, **any plain rule you write overrides meowdown with no `!important` and no specificity hacks** (e.g. `.ProseMirror h1 { font-size: 2rem }` wins over meowdown's layered heading rule). Put your overrides outside any `@layer`, or in a layer you declare after `meowdown`.

**With Tailwind CSS v4**, import `@meowdown/core/style.css` _after_ `@import 'tailwindcss'` so the `meowdown` layer sorts after Tailwind's `theme` / `base` / `components` / `utilities`. That keeps meowdown's editor styles from being reset by Tailwind's `base` (Preflight) while your own un-layered rules still win. One caveat: with that order the `meowdown` layer also sorts after `utilities`, so a Tailwind utility _class_ placed directly on an editor element will not beat meowdown. If you need utilities to win (while meowdown still beats Preflight), declare the layer order yourself with `utilities` last, referencing the umbrella `meowdown` layer (not its sub-layers). Doing this at the top of your CSS also pins the order even when meowdown's stylesheet is code-split / lazy-loaded:

```css
@layer theme, base, components, meowdown, utilities;
@import 'tailwindcss';
@import '@meowdown/core/style.css';
```

Two things the variable list cannot show: `--meowdown-gutter` is the horizontal editor padding, applied to the editable root's `.meowdown-content` class (set by `@meowdown/react`), not `.ProseMirror`, so the block handle's drag preview stays unpadded; floating UI such as the block handle lives inside it, so keep it at least `3.5rem`. A headless mount (like the quick start above) has no `.meowdown-content`, so add that class to the mount element (or your own padding) yourself. The selection variables (`--meowdown-selection`, `--meowdown-node-outline`, `--meowdown-node-selection`) are standalone, not derived from `--meowdown-accent`, so selection can be restyled independently.

Tags (`#tag`) render as pills via the `.md-tag` class, tinted from `--meowdown-accent`. Wire click handling with `defineTagClickHandler(({ tag, event }) => ...)` (or `@meowdown/react`'s `onTagClick` prop); `tag` is read from the rendered text without the leading `#`.

Wikilinks (`[[target]]`/`[[target|alias]]`) render in place via a mark view as an immutable label (the alias, or the target when there is no alias), with the raw source hidden in hide and focus modes and shown dimmed in show mode. The label uses the `.md-wikilink-view-label` class, dashed-underlined and colored by `--meowdown-accent`. In every mark mode the link is a single immutable caret stop: arrowing onto it selects the whole source (ringed with `--meowdown-node-outline` in hide and focus, the native selection over the visible source in show), and Backspace/Delete remove it as a unit. Wire click navigation with `defineWikilinkClickHandler(({ target, event }) => ...)` (or `@meowdown/react`'s `onWikilinkClick` prop); `Mod-Enter` with the caret on a wikilink, tag, or Markdown link fires the same handler, with the `KeyboardEvent` as `event`. `defineWikilinkHoverHandler` reports the hovered target, source range, and visible anchor element, then reports `undefined` on leave, deletion, replacement, or editor teardown.

Markdown links (`[text](url)`) render the label as an `<a href>` with the `.md-link` class, colored by `--meowdown-accent`; the `[`, `]`, and `(url)` syntax dims in show mode and hides in hide and focus modes. Wire click handling with `defineLinkClickHandler(({ href, event }) => ...)` (or `@meowdown/react`'s `onLinkClick` prop).

Bare URLs autolink without `[text](url)` brackets and share the same `.md-link` rendering and click handling: a scheme URL (`https://example.com`), an angle autolink (`<https://example.com>`), a `www.` host (`www.example.com`), an email (`me@example.com`), and a bare domain (`google.com`, `sub.domain.io/path`). Bare domains are matched against a curated list of common TLDs, so file names and prose keep their dots without linkifying (`README.md`, `node.js`, `i.e.` stay plain text); reach for `[text](url)` or `<url>` to link anything off that list. Autolinks are derived live from the text, so editing one re-evaluates it; the caret sitting inside a link never un-links it.

Inline images (`![alt](src)`) stay literal text and render in place via a mark view, with the raw `![alt](src)` hidden in hide and focus modes. Add it with [`defineImage`](https://npmx.dev/package-docs/@meowdown%2Fcore#function-defineImage) (or `@meowdown/react`'s image props) and wire click handling with [`defineImageClickHandler`](https://npmx.dev/package-docs/@meowdown%2Fcore#function-defineImageClickHandler) (`@meowdown/react`'s `onImageClick` prop).

Pasted or dropped files persist through [`defineFilePaste`](https://npmx.dev/package-docs/@meowdown%2Fcore#function-defineFilePaste) (or `@meowdown/react`'s `onFilePaste` prop): the handler persists each file and returns its markdown destination. An image (`image/*` MIME type) inserts `![](src)`; any other file inserts a `[name](src)` link; multiple files insert one link per line, in the order they appear in the drop. Without `onFilePaste`, file events are left to the browser's default handling. A host command that inserts file links itself (e.g. an attach-file picker) can build the same markdown with [`buildFileMarkdown`](https://npmx.dev/package-docs/@meowdown%2Fcore#function-buildFileMarkdown).

A host can render chosen file links as inline **file pills**: pass `resolveFileLink` to [`defineEditorExtension`](https://npmx.dev/package-docs/@meowdown%2Fcore#function-defineEditorExtension) (or `@meowdown/react`'s `resolveFileLink` prop) to claim links by their href (e.g. everything under `assets/`), and add [`defineFileView`](https://npmx.dev/package-docs/@meowdown%2Fcore#function-defineFileView) to render each claimed link as a pill: a file-kind icon, the name, and the size supplied (possibly async) by `resolveFileInfo`. The markdown text is untouched, and a claimed link behaves like an image: one caret unit with an editable source, clicks (and `Mod-Enter` with the caret on it) reported through [`defineFileClickHandler`](https://npmx.dev/package-docs/@meowdown%2Fcore#function-defineFileClickHandler) (`@meowdown/react`'s `onFileClick`) rather than the link click handler, and no link hover or edit menu.

Rendered images are resizable: drag the corner handle and the chosen size is written back into the source as a trailing comment, `![alt](src)<!-- {"width":320,"height":240} -->`, which round-trips as plain Markdown. A comment immediately after an image is folded into its mark and drives the image's `width` and `height` attributes, so the box keeps its dimensions before the image loads; any other comment stays literal text.

GFM table column alignment (`| :-: |` in the delimiter row) is kept as an `align` attribute on every cell and rendered through a `data-align` DOM attribute (`text-align` in the bundled stylesheet). Alignment is a column property: the header row's cells carry the source of truth, data cells (including rows inserted later) follow it automatically. Change it with the `setTableColumnAlign` command (`editor.commands.setTableColumnAlign('center')`, `null` resets to `---`), and read the alignment of the selection's column with [`getTableColumnAlign`](https://npmx.dev/package-docs/@meowdown%2Fcore#function-getTableColumnAlign).

Pasting a lone tweet or YouTube link can auto-embed it: [`defineEmbedPaste`](https://npmx.dev/package-docs/@meowdown%2Fcore#function-defineEmbedPaste) (`@meowdown/react`'s `embedPaste` prop, on by default).

The clipboard pipeline ships inside `defineEditorExtension`. Copying writes two flavors: `text/html` is standard semantic HTML (`<h3>`, `<ol><li>`, `<strong>`, real `<table>`) with the Markdown source preserved in `data-md` attributes so meowdown-to-meowdown pastes stay byte-exact, and `text/plain` is Markdown, where opening markers such as ATX heading and blockquote prefixes are kept when the selection includes the block's content start, while fenced code blocks and tables keep their markers only when selected completely; the mark mode decides the inline layer (hide strips the syntax characters, focus and show keep the full source). Pasting picks a path by flavor: meowdown's own HTML (stamped `data-meowdown`) parses natively; foreign rich-text HTML, including other ProseMirror editors, converts to Markdown through the unified (rehype / remark) pipeline; plain text follows Markdown newline semantics (a blank line separates paragraphs without inserting an empty one, a single newline stays a soft break) while a Shift-paste keeps ProseMirror's line-per-paragraph behavior; a paste landing in a code block stays plain text.

Enter at the end of the document's first heading (the title line) can start a fresh empty bullet instead of a plain paragraph: [`defineBulletAfterHeading`](https://npmx.dev/package-docs/@meowdown%2Fcore#function-defineBulletAfterHeading) (`@meowdown/react`'s `bulletAfterHeading` prop). Not part of `defineEditorExtension`.

An arrow press that can move the caret no further can notify the host, so it can move focus elsewhere (a previous/next note or page): [`defineExitBoundaryHandler`](https://npmx.dev/package-docs/@meowdown%2Fcore#function-defineExitBoundaryHandler) (`@meowdown/react`'s `onExitBoundary` prop). Not part of `defineEditorExtension`.

## API

See the full API reference [here](https://npmx.dev/package-docs/@meowdown%2Fcore/).

## License

MIT
