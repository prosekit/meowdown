# @meowdown/react

React components for Meowdown, a hybrid (live-preview) Markdown editor.

[**Live demo**](https://meowdown.vercel.app/)

## Quick start

Install the package and its peer dependencies:

```sh
npm install @meowdown/react @meowdown/core react react-dom
```

Import both stylesheets and render the editor:

```tsx
import '@meowdown/core/style.css'
import '@meowdown/react/style.css'
import { MeowdownEditor } from '@meowdown/react'

export function App() {
  return <MeowdownEditor initialMarkdown="# Hello" />
}
```

## Usage

```tsx
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

## Components

| Component | Description |
| --- | --- |
| `MeowdownEditor` | The editor. Callbacks and resolvers must be stable; pass them via `useCallback`. |
| `MarkdownView` | Read-only Markdown renderer. `interactive={false}` renders passive content for previews. |
| `WikilinkHoverCard` | Mount inside `MeowdownEditor`; renders host content for the hovered wiki link's `target`. Return `null` to render no card. |

Common `MeowdownEditor` props:

| Prop | What it does |
| --- | --- |
| `mode` | `'focus'` (default), `'show'`, or `'hide'`: how much Markdown syntax stays in view |
| `searchQuery` / `onSearchChange` | Find in document, with `EditorHandle.findNext()` / `findPrevious()` |
| `onWikilinkClick` / `onLinkClick` / `onTagClick` / `onImageClick` / `onFileClick` | Click handling for the rendered atoms |
| `resolveImageUrl` / `resolveWikiEmbed` / `resolveFileLink` / `resolveFileInfo` | Resolve and classify local content |
| `onFilePaste` | Persist pasted or dropped files |
| `onSlashMenuSearch` / `onTagSearch` / `onWikilinkSearch` / `onSelectionMenuSearch` | Search menus for `/`, `#`, `[[`, and selection commands |
| `readOnly` / `placeholder` / `blockHandle` / `caretGlide` / `embedPaste` / `linkPaste` / `bulletAfterHeading` | Behavior toggles |

Every prop, callback, and `EditorHandle` method is documented in the [API reference](https://npmx.dev/package-docs/@meowdown%2Freact/).

## Styling

Import both stylesheets: `@meowdown/core/style.css` (the editor theme and variables) and `@meowdown/react/style.css` (the component layout). The core theme is documented in [`@meowdown/core`](https://www.npmjs.com/package/@meowdown/core).

## License

MIT
