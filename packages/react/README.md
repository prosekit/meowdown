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

See the full API reference [here](https://npmx.dev/package-docs/@meowdown%2Freact/).

Slash menu host items can include `keywords` to match hidden terms without changing the displayed label.

### Wiki-link hover cards

Mount `WikilinkHoverCard` inside `MeowdownEditor` and render host-owned preview
content from the hovered wiki link's `target`. Returning `null` renders no
card. The render function may also return a promise: the card stays closed
until it resolves, resolving to `null` (or rejecting) renders no card, and a
result that lands after the pointer moved on is discarded, so a host can look
up local content without ever flashing an empty card.

```tsx
<MeowdownEditor initialMarkdown="See [[Project plan]]">
  <WikilinkHoverCard>
    {async (hit) => {
      const note = await readLocalNote(hit.target)
      return note == null ? null : <LocalNotePreview note={note} />
    }}
  </WikilinkHoverCard>
</MeowdownEditor>
```

For local-only passive preview content, render Markdown with interaction
disabled: the tree contains no anchors or focusable controls, and recognized
tweet and YouTube embeds are omitted before any image resolver runs. Supply a
resolver that accepts only trusted local image sources.

```tsx
<MarkdownView markdown={markdown} interactive={false} resolveImageUrl={resolveLocalImageUrl} />
```

## Styling

Import both stylesheets: `@meowdown/core/style.css` (the editor theme and variables) and `@meowdown/react/style.css` (the component layout). The core theme is documented in [`@meowdown/core`](https://www.npmjs.com/package/@meowdown/core).

## License

MIT
