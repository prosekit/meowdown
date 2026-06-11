# @meowdown/react

React components for Meowdown, a hybrid (live-preview) Markdown editor.

## Usage

```tsx
import { Editor } from '@meowdown/react'
import '@meowdown/react/style.css'

export function App() {
  return (
    <Editor
      mode="focus"
      initialContent="# Hello"
      onChange={({ getMarkdown }) => console.log(getMarkdown())}
    />
  )
}
```

## API

### `<Editor>`

- `mode?: 'focus' | 'show' | 'hide' | 'source'`: defaults to `'focus'`.
  - `'focus'`: Markdown syntax is hidden, revealed around the cursor.
  - `'show'`: Markdown syntax is always visible.
  - `'hide'`: Markdown syntax is always hidden.
  - `'source'`: raw Markdown source with syntax highlighting.
- `initialContent?: string`: Markdown. First render only.
- `onChange?: (options: ChangeHandlerOptions) => void`: called on every content change. Memoize it.

### `ChangeHandlerOptions`

`{ getMarkdown: () => string }`. Lazy: nothing is serialized until you call it.

## License

MIT
