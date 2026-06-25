# @meowdown/react

React components for Meowdown, a hybrid (live-preview) Markdown editor.

## Usage

```tsx
import '@meowdown/core/style.css'
import '@meowdown/react/style.css'

import { MeowdownEditor, type EditorHandle } from '@meowdown/react'
import { useRef, useCallback } from 'react'

export function App() {
  const ref = useRef<EditorHandle>(null)
  const handleDocChange = useCallback(() => {
    console.log(ref.current?.getMarkdown())
  }, [])

  return (
    <MeowdownEditor
      handleRef={ref}
      mode="focus"
      initialMarkdown="# Hello"
      onDocChange={handleDocChange}
    />
  )
}
```

## API

See the full API reference on [npmx](https://npmx.dev/package-docs/@meowdown%2Freact/).

## Styling

Import both stylesheets: `@meowdown/core/style.css` (the editor theme and variables) and `@meowdown/react/style.css` (the component layout). The core theme is documented in [`@meowdown/core`](https://www.npmjs.com/package/@meowdown/core).

## License

MIT
