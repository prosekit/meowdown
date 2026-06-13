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

## Images

`defineImageExtension(options)` adds two capabilities, both built on the same idea: the document never holds an image node. `![alt](src)` stays literal Markdown text, so serialization is byte-identical and there is no round-trip risk; the picture renders as a non-editable widget inline, at the image's position in the text.

- **Preview**: each `![alt](src)` renders an `<img>` inline where its syntax sits, flowing with the surrounding text. A `resolveUrl` callback maps the Markdown `src` to a displayable URL (or `null` to skip rendering).
- **Upload**: when an `upload` callback is given, pasting or dropping image files inserts a `![](blob:...)` placeholder at the caret (or the drop point) immediately, so the local image shows at once; `upload` then resolves to the final src, which is swapped in.

Upload reuses ProseKit's `UploadTask` (from `@prosekit/extensions/file`): the temporary `blob:` object URL is the placeholder's src and its unique identity. When the upload finishes, the document is re-scanned for that object URL and the src is swapped in place, so concurrent edits, undo, and even duplicating the placeholder are handled with no stored position.

```ts
import { defineImageExtension } from '@meowdown/core'
import { union } from '@prosekit/core'

const extension = union(
  defineEditorExtension(),
  defineImageExtension({
    resolveUrl: (src) => (src.startsWith('assets/') ? `/files/${src}` : src),
    upload: async (file) => {
      const path = await saveToDisk(file)
      return path
    },
    onUploadError: ({ error, file }) => console.error('upload failed', file.name, error),
  }),
)
```

| Option          | Type                                        | Default           | Description                                                                                                            |
| --------------- | ------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `resolveUrl`    | `(src: string) => string \| null`           | safe pass-through | Maps a Markdown `src` to a displayable URL, or `null` to not render.                                                   |
| `upload`        | `(file: File) => string \| Promise<string>` | (none)            | Persists a pasted/dropped image and resolves to the src to embed. Reject to fail. Omit to disable paste/drop handling. |
| `canUpload`     | `(file: File) => boolean`                   | accepts `image/*` | Decides which files to upload, before any placeholder is inserted (e.g. a size limit).                                 |
| `onUploadError` | `({ error, file }) => void`                 | `console.error`   | Called when `upload` throws or rejects.                                                                                |

The default `resolveUrl` (`defaultResolveImageUrl`, also exported) is a strict allow-list: it passes through `data:image/*`, `http:`, `https:`, and `blob:` URLs and returns `null` for everything else, so remote and demo images render out of the box while relative paths and `javascript:` URLs never do. Relative paths only render once the host supplies a `resolveUrl` that knows what they mean.

Paste/drop notes: a clipboard carrying image files is consumed entirely (any text/html alongside the bitmap is ignored); `canUpload` filters files before insertion; a failed upload removes its placeholder (a `blob:` URL must never persist into saved Markdown); remaining files in the same paste/drop continue even if one fails. While an upload is in flight the document briefly holds a `blob:` src, so serializing mid-upload captures it until the upload completes.

Customize the preview via these variables:

- `--meowdown-image-max-height`: maximum rendered image height (default `28rem`).
- `--meowdown-image-radius`: image corner radius (default `0.6rem`).

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
- `--meowdown-font-mono`: monospace font stack.
- `--meowdown-gutter`: horizontal editor padding. Floating UI such as the block handle (in `@meowdown/react`) lives inside it; keep it at least `3.5rem`.
- `--meowdown-selection`: text `::selection` background.
- `--meowdown-node-outline`: outline of a selected node; border color of selected tables and cells.
- `--meowdown-node-selection`: background wash of a selected node or selected cells.

Selection colors are standalone variables, not derived from `--meowdown-accent`, so selection can be restyled independently.

Tags (`#tag`) render as pills via the `.md-tag` class, tinted from `--meowdown-accent`.

Wikilinks (`[[target]]`) render with a dashed underline via the `.md-wikilink` class, colored by `--meowdown-accent`. Their `[[` `]]` brackets behave like other syntax characters: dimmed in show mode, hidden in hide and focus modes.

## License

MIT
