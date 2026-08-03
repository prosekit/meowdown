# @meowdown/core

The engine behind Meowdown, a hybrid (live-preview) Markdown editor: Markdown
parsing, serializing, editing commands, and a default theme. Framework-free;
pairs with [@meowdown/react](https://www.npmjs.com/package/@meowdown/react).

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

## Markdown features

[CommonMark](https://commonmark.org/) and [GFM](https://github.github.com/gfm/), plus:

- Wikilinks (`[[target]]`, `[[target|alias]]`)
- Wiki embeds (`![[path]]`)
- Tags (`#tag`)
- Highlight (`==highlight==`)
- Math (`$x$`, `$$x$$`, and ` ```math ` fenced code blocks), rendered as native MathML
- Bare-domain autolinks (`google.com`), behind a curated TLD allowlist so `README.md` and `node.js` stay plain text

## Keyboard shortcuts

`Mod` is Cmd on macOS and Ctrl elsewhere. Formatting shortcuts insert or remove
the literal Markdown delimiters around the selection; heading shortcuts toggle
the current block to that level (or back to a paragraph).

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

`Mod-Shift-7/8/9` wrap the current block, convert a list of a different kind in
place, and unwrap a list of the same kind back to a paragraph. `Alt-ArrowUp` /
`Alt-ArrowDown` move the block or list item with its nested children. Typing `[`
over a selection wraps it into an open wikilink (`[[selection`) with the
wikilink menu searching it. `EDITOR_KEY_BINDINGS` exports this table as a
literal object for host settings UIs.

## Round-trip fidelity

[`checkRoundTrip(markdown)`](https://npmx.dev/package-docs/@meowdown%2Fcore#function-checkRoundTrip) reports how faithfully Markdown survives a parse-then-serialize round trip: `'exact'`, `'normalizing'`, or `'lossy'`.

## Styling

`@meowdown/core/style.css` ships a default theme. Colors use `light-dark()`, so they follow the page's `color-scheme` (set `color-scheme: light dark` on `:root` for automatic dark mode). Override the `--meowdown-*` variables on `:root` or any ancestor; the full list, with a one-line description and default for each, lives in the commented `:root` block at the top of `style.css`, which is the single source of truth.

CSS is wrapped in `@layer meowdown` (sub-layers `meowdown.base`, `meowdown.theme`, `meowdown.editor`). An un-layered rule always beats a layered one, so any plain rule you write overrides meowdown with no `!important` and no specificity hacks. Put your overrides outside any `@layer`, or in a layer you declare after `meowdown`.

**With Tailwind CSS v4**, import `@meowdown/core/style.css` _after_ `@import 'tailwindcss'` so the `meowdown` layer sorts after Tailwind's `base` (Preflight). If you also need Tailwind utilities to win over meowdown (while meowdown still beats Preflight), declare the layer order yourself:

```css
@layer theme, base, components, meowdown, utilities;
@import 'tailwindcss';
@import '@meowdown/core/style.css';
```

## API

See the full API reference [here](https://npmx.dev/package-docs/@meowdown%2Fcore/).

## License

MIT
