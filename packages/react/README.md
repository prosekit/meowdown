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

  return (
    <Editor
      ref={ref}
      mode="focus"
      initialMarkdown="# Hello"
      onDocChange={handleDocChange}
    />
  )
}
```

## API

### `<Editor>`

The Markdown editor component

- `mode?: 'focus' | 'show' | 'hide' | 'source'`: defaults to `'focus'`.
  - `'focus'`: Markdown syntax is hidden, revealed around the cursor.
  - `'show'`: Markdown syntax is always visible.
  - `'hide'`: Markdown syntax is always hidden.
  - `'source'`: raw Markdown source with syntax highlighting.
- `initialMarkdown?: string`: first render only.
- `onDocChange?: VoidFunction`: called on every document change.
- `ref?: Ref<EditorHandle>`

### `EditorHandle`

Imperative handle for the editor, attached via `ref`.

- `getMarkdown(): string`: serializes the current document to Markdown. Can be expensive on large documents; call it on demand (e.g. throttled) instead of on every change.

## License

MIT
