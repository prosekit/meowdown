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

The Markdown editor component. Renders inside a `div.meowdown` wrapper that fills a flex parent. In rich modes, typing `/` opens a slash menu for inserting blocks (headings, blockquote, lists, code block, table). Hovering a block shows a handle to its left: the plus button inserts an empty paragraph below the block, and the grip selects the block and can be dragged to move it, with a drop indicator line marking the target. Code blocks are syntax-highlighted with [Lezer](https://lezer.codemirror.net) grammars (loaded on demand from [`@codemirror/language-data`](https://www.npmjs.com/package/@codemirror/language-data)) and carry a language selector and a copy button in their top-right corner.

- `mode?: 'focus' | 'show' | 'hide' | 'source'`: defaults to `'focus'`.
  - `'focus'`: Markdown syntax is hidden, revealed around the cursor.
  - `'show'`: Markdown syntax is always visible.
  - `'hide'`: Markdown syntax is always hidden.
  - `'source'`: raw Markdown source with syntax highlighting.
- `initialMarkdown?: string`: first render only.
- `onDocChange?: VoidFunction`: called on every document change.
- `onTagSearch?: (query: string) => string[] | Promise<string[]>`: enables the tag menu, which opens when typing `#` followed by text in a rich mode; returns the tags to show for a query (lowercased, punctuation stripped). Omit to disable.
- `onWikilinkSearch?: (query: string) => string[] | Promise<string[]>`: enables the wikilink menu, which opens as soon as `[[` is typed in a rich mode; returns the note names to show for a query (lowercased, punctuation stripped, may be empty). Selecting a note inserts `[[Note Name]]`. Omit to disable.
- `spellCheck?: boolean`: toggles the browser's native spell checking in the rich modes. Defaults to the browser's behavior. Ignored in source mode.
- `ref?: Ref<EditorHandle>`

### `EditorHandle`

Imperative handle for the editor, attached via `ref`.

- `getMarkdown(): string`: serializes the current document to Markdown. Can be expensive on large documents; call it on demand (e.g. throttled) instead of on every change.
- `setMarkdown(markdown: string): void`: replaces the whole document as a single undoable edit.
- `getState(): EditorStateSnapshot`: returns `[markdown, selection]`, where `selection` is a `SelectionJSON` (`{ anchor: number, head: number, type: string }`).
- `setState(markdown?: string, selection?: SelectionJSON | 'start' | 'end'): void`: replaces the document (if `markdown` is given) and restores `selection`: exactly when valid, otherwise clamped to the nearest text selection; out-of-range positions never throw. `'start'` and `'end'` jump to the document edges. Without a selection, the current one is mapped through the change. Restore a snapshot with `handle.setState(...handle.getState())`.
- `getSelection(): SelectionJSON`: returns the current selection.
- `setSelection(selection: SelectionJSON | 'start' | 'end'): void`: restores a selection with the same hint semantics as `setState`.
- `focus(): void`: focuses the editor.
- `scrollIntoView(): void`: scrolls the selection into view.

Selection positions are in the mounted editor's coordinate space: ProseMirror document positions in the rich modes, character offsets in source mode. They round-trip within one mode but are not portable across a mode switch.

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
