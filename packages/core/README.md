# @meowdown/core

The engine powering the editor in [`@meowdown/react`](https://www.npmjs.com/package/@meowdown/react): a hybrid (live-preview) Markdown editor core built on ProseKit and Lezer.

## Styling

`@meowdown/core/style.css` ships a default editor theme. Colors use `light-dark()`, so they follow the page's `color-scheme` (set `color-scheme: light dark` on `:root` for automatic dark mode). Customize by overriding these variables on `:root` or any ancestor:

- `--meowdown-text`: body text color.
- `--meowdown-heading`: heading color.
- `--meowdown-muted`: secondary text (blockquotes).
- `--meowdown-accent`: links, caret, inline code, tags.
- `--meowdown-mark`: Markdown syntax characters.
- `--meowdown-border`: horizontal rules.
- `--meowdown-code-bg`: code block background.
- `--meowdown-font-mono`: monospace font stack.

Tags (`#tag`) render as pills via the `.md-tag` class, tinted from `--meowdown-accent`.

## License

MIT
