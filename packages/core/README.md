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
- `--meowdown-font-mono`: monospace font stack.
- `--meowdown-gutter`: horizontal editor padding. Floating UI such as the block handle (in `@meowdown/react`) lives inside it; keep it at least `3.5rem`.
- `--meowdown-selection`: text `::selection` background.
- `--meowdown-node-outline`: outline of a selected node; border color of selected tables and cells.
- `--meowdown-node-selection`: background wash of a selected node or selected cells.

Selection colors are standalone variables, not derived from `--meowdown-accent`, so selection can be restyled independently.

Tags (`#tag`) render as pills via the `.md-tag` class, tinted from `--meowdown-accent`.

Wikilinks (`[[target]]`) render with a dashed underline via the `.md-wikilink` class, colored by `--meowdown-accent`, with a pointer cursor. Their `[[` `]]` brackets behave like other syntax characters: dimmed in show mode, hidden in hide and focus modes. Wire click navigation with `defineWikilinkClickHandler(({ target, event }) => ...)` (or `@meowdown/react`'s `onWikilinkClick` prop).

Inline images (`![alt](src)`) stay literal text and render beneath their line as a widget decoration when a host resolves the `src` to a URL. Add it with `defineImages({ resolveImageUrl, onImagePaste })` (or `@meowdown/react`'s image props).

## License

MIT
