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
- `--meowdown-border`: horizontal rules.
- `--meowdown-code-bg`: code block background.
- `--meowdown-font-mono`: monospace font stack.

Tags (`#tag`) render as pills via the `.md-tag` class, tinted from `--meowdown-accent`.

Wikilinks (`[[target]]`) render with a dashed underline via the `.md-wikilink` class, colored by `--meowdown-accent`. Their `[[` `]]` brackets behave like other syntax characters: dimmed in show mode, hidden in hide and focus modes.

## License

MIT
