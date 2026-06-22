# @meowdown/core

The engine powering the editor in [`@meowdown/react`](https://www.npmjs.com/package/@meowdown/react): a hybrid (live-preview) Markdown editor core built on ProseKit and Lezer.

## Shortcuts

The editor extension binds inline-format toggles (`Mod` = Cmd on macOS, Ctrl elsewhere). Each one inserts or removes the literal Markdown delimiters around the selection; with a caret it plants an empty pair, or hops across a span's closing delimiter so typing enters or leaves the format. Each is also an editor command.

| Key           | Command                          | Markdown            |
| ------------- | -------------------------------- | ------------------- |
| `Mod-B`       | `editor.commands.toggleStrong()` | `**bold**`          |
| `Mod-I`       | `editor.commands.toggleEm()`     | `*italic*`          |
| `Mod-E`       | `editor.commands.toggleCode()`   | `` `code` ``        |
| `Mod-Shift-X` | `editor.commands.toggleDel()`    | `~~strikethrough~~` |

Heading shortcuts toggle the current block to a heading of that level (or back to a paragraph):

| Key     | Action    |
| ------- | --------- |
| `Mod-1` | Heading 1 |
| `Mod-2` | Heading 2 |
| `Mod-3` | Heading 3 |
| `Mod-4` | Heading 4 |
| `Mod-5` | Heading 5 |
| `Mod-6` | Heading 6 |

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
- `--meowdown-image-max-height`: max height of rendered inline images.
- `--meowdown-image-radius`: corner radius of rendered inline images.
- `--meowdown-placeholder`: placeholder text color (defaults to `--meowdown-muted`).
- `--meowdown-font-mono`: monospace font stack.
- `--meowdown-gutter`: horizontal editor padding. Applied to the editable root's `.meowdown-content` class (set by `@meowdown/react`), not `.ProseMirror`, so the block handle's drag preview stays unpadded. Floating UI such as the block handle lives inside it; keep it at least `3.5rem`.
- `--meowdown-selection`: text `::selection` background.
- `--meowdown-node-outline`: outline of a selected node; border color of selected tables and cells.
- `--meowdown-node-selection`: background wash of a selected node or selected cells.

Selection colors are standalone variables, not derived from `--meowdown-accent`, so selection can be restyled independently.

Tags (`#tag`) render as pills via the `.md-tag` class, tinted from `--meowdown-accent`.

Wikilinks (`[[target]]`/`[[target|alias]]`) render in place via a mark view as an immutable label (the alias, or the target when there is no alias), with the raw source hidden in hide and focus modes and shown dimmed in show mode. The label uses the `.md-wikilink-label` class and the raw source the `.md-wikilink-source` class, both dashed-underlined and colored by `--meowdown-accent`. In every mark mode the link is a single immutable caret stop: arrowing onto it selects the whole source (ringed with `--meowdown-node-outline` in hide and focus, the native selection over the visible source in show), and Backspace/Delete remove it as a unit. Wire click navigation with `defineWikilinkClickHandler(({ target, event }) => ...)` (or `@meowdown/react`'s `onWikilinkClick` prop).

Markdown links (`[text](url)`) render the label as an `<a href>` with the `.md-link` class, colored by `--meowdown-accent`; the `[`, `]`, and `(url)` syntax dims in show mode and hides in hide and focus modes. Wire click handling with `defineLinkClickHandler(({ href, event }) => ...)` (or `@meowdown/react`'s `onLinkClick` prop). A plain click inside a link the caret already sits in just places the caret; `Mod`-click always fires.

Bare URLs autolink without `[text](url)` brackets and share the same `.md-link` rendering and click handling: a scheme URL (`https://example.com`), an angle autolink (`<https://example.com>`), a `www.` host (`www.example.com`), an email (`me@example.com`), and a bare domain (`google.com`, `sub.domain.io/path`). Bare domains are matched against a curated list of common TLDs, so file names and prose keep their dots without linkifying (`README.md`, `node.js`, `i.e.` stay plain text); reach for `[text](url)` or `<url>` to link anything off that list. Autolinks are derived live from the text, so editing one re-evaluates it; the caret sitting inside a link never un-links it.

Inline images (`![alt](src)`) stay literal text and render in place via a mark view, with the raw `![alt](src)` hidden in hide and focus modes. Add it with `defineImage({ resolveImageUrl, onImagePaste })` (or `@meowdown/react`'s image props). `resolveImageUrl` is optional and defaults to showing http(s) URLs as-is. Wire click handling with `defineImageClickHandler(({ src, alt, event }) => ...)` (or `@meowdown/react`'s `onImageClick` prop).

Pasting a lone tweet or YouTube link can auto-embed it. `defineEmbedPaste()` (or `@meowdown/react`'s `embedPaste` prop) rewrites the pasted link to `![](url)` so it renders as an embed; one undo turns the embed back into the raw link. It is not part of `defineEditorExtension`; add it explicitly.

Pasting rich-text HTML from a browser (a bullet list, **bold**, a link, ...) converts it to Markdown so the formatting survives instead of arriving as plain text. `defineHTMLPaste()` (applied by default in `@meowdown/react`) rewrites the clipboard's `text/html` through the unified (rehype / remark) pipeline and reparses the Markdown with the editor's schema; meowdown's own clipboard (tagged `data-pm-slice`) and any paste landing in a code block are left to the default path. Going the other way, `defineMarkdownCopy()` serializes copied content to Markdown for the clipboard's `text/plain` flavor, so pasting into a plain-text field keeps list markers and block structure. Neither is part of `defineEditorExtension`; add them explicitly.

Pressing Enter at the end of the document's first heading (the title line) can start a fresh empty bullet on the next line instead of a plain paragraph. `defineBulletAfterHeading()` binds this. It is not part of `defineEditorExtension`; add it explicitly.

## Re-exports

`Priority` and `withPriority` are re-exported from `@prosekit/core`, so you can set extension priorities (e.g. `withPriority(extension, Priority.high)`) without depending on `@prosekit/core` directly.

## License

MIT
