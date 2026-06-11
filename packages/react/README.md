# @meowdown/react

React components for Meowdown, a hybrid (live-preview) Markdown editor.

## Usage

```tsx
import { Editor, type EditorHandle } from '@meowdown/react'
import '@meowdown/react/style.css'
import { useRef, useCallback } from 'react'

export function App() {
  const ref = useRef<EditorHandle>(null)
  const handleDocChange = useCallback(() => {
    console.log(ref.current?.getMarkdown())
  }, [])

  return <Editor ref={ref} mode="focus" initialMarkdown="# Hello" onDocChange={handleDocChange} />
}
```

## API

### `<Editor>`

The Markdown editor component. Renders inside a `div.meowdown` wrapper that fills a flex parent. In rich modes, typing `/` opens a slash menu for inserting blocks (headings, blockquote, lists, code block, table). Hovering a block shows a handle to its left: the plus button inserts an empty paragraph below the block, and the grip selects the block and can be dragged to move it, with a drop indicator line marking the target.

- `mode?: 'focus' | 'show' | 'hide' | 'source'`: defaults to `'focus'`.
  - `'focus'`: Markdown syntax is hidden, revealed around the cursor.
  - `'show'`: Markdown syntax is always visible.
  - `'hide'`: Markdown syntax is always hidden.
  - `'source'`: raw Markdown source with syntax highlighting.
- `initialMarkdown?: string`: first render only.
- `onDocChange?: VoidFunction`: called on every document change.
- `onTagSearch?: (query: string) => string[] | Promise<string[]>`: enables the tag menu, which opens when typing `#` followed by text in a rich mode; returns the tags to show for a query (lowercased, punctuation stripped). Omit to disable.
- `onWikilinkSearch?: (query: string) => string[] | Promise<string[]>`: enables the wikilink menu, which opens as soon as `[[` is typed in a rich mode; returns the note names to show for a query (lowercased, punctuation stripped, may be empty). Selecting a note inserts `[[Note Name]]`. Omit to disable.
- `ref?: Ref<EditorHandle>`

### `EditorHandle`

Imperative handle for the editor, attached via `ref`.

- `getMarkdown(): string`: serializes the current document to Markdown. Can be expensive on large documents; call it on demand (e.g. throttled) instead of on every change.

## Keyboard shortcuts

In the rich modes (`focus` / `show` / `hide`), these toggle inline formatting on the selection (`Mod` = Cmd on macOS, Ctrl elsewhere):

| Key           | Action               |
| ------------- | -------------------- |
| `Mod-B`       | toggle bold          |
| `Mod-I`       | toggle italic        |
| `Mod-E`       | toggle inline code   |
| `Mod-Shift-X` | toggle strikethrough |

## Styling

`@meowdown/react/style.css` includes the default theme from [`@meowdown/core`](https://www.npmjs.com/package/@meowdown/core).

## License

MIT
