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

`checkRoundTrip(markdown)` reports how faithfully markdown survives a parse-then-serialize round trip: `'exact'` (byte-identical modulo the trailing newline), `'normalizing'` (same non-blank lines, only blank-line layout differs), or `'lossy'` (a non-blank line changed, e.g. setext headings or raw HTML blocks). Hosts that keep markdown on disk can gate saves on it, opening lossy files read-only so a save never rewrites content.

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
- `--meowdown-gutter`: horizontal editor padding. Floating UI such as the block handle (in `@meowdown/react`) lives inside it; keep it at least `3.5rem`.
- `--meowdown-selection`: text `::selection` background.
- `--meowdown-node-outline`: outline of a selected node; border color of selected tables and cells.
- `--meowdown-node-selection`: background wash of a selected node or selected cells.

Selection colors are standalone variables, not derived from `--meowdown-accent`, so selection can be restyled independently.

Tags (`#tag`) render as pills via the `.md-tag` class, tinted from `--meowdown-accent`.

Wikilinks (`[[target]]`) render with a dashed underline via the `.md-wikilink` class, colored by `--meowdown-accent`, with a pointer cursor. Their `[[` `]]` brackets behave like other syntax characters: dimmed in show mode, hidden in hide and focus modes. Wire click navigation with `defineWikilinkClickHandler(({ target, event }) => ...)` (or `@meowdown/react`'s `onWikilinkClick` prop).

Inline images (`![alt](src)`) stay literal text and render beneath their line as a widget decoration when a host resolves the `src` to a URL. Add it with `defineImages({ resolveImageUrl, onImagePaste })` (or `@meowdown/react`'s image props).

Pasting a lone tweet or YouTube link can auto-embed it. `defineEmbedPaste()` (or `@meowdown/react`'s `embedPaste` prop) rewrites the pasted link to `![](url)` so it renders as an embed; one undo turns the embed back into the raw link. It is not part of `defineEditorExtension`; add it explicitly.

Pressing Enter at the end of the document's first heading (the title line) can start a fresh empty bullet on the next line instead of a plain paragraph. A heading anywhere else is left to the default Enter. `defineBulletAfterHeading()` binds this. It is not part of `defineEditorExtension`; add it explicitly.

## License

MIT
