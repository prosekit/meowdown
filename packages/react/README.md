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

The caret glides between positions by default; pass `caretGlide={false}` to move it instantly (hosts can also tune the duration via the `--meowdown-caret-glide` CSS variable).

### Wiki embeds

Obsidian-style wiki embeds (`![[path]]`, with optional `|width` or
`|widthxheight`) stay literal and editable unless the host classifies them.
`resolveWikiEmbed` is a pure, creation-time resolver: return an image, file, or
note result to reuse the corresponding Meowdown atom and its existing click
hook; return `undefined` for missing or ambiguous targets.

```tsx
<MeowdownEditor
  initialMarkdown="![[assets/photo.png|320]]"
  resolveWikiEmbed={({ target }) => (target.endsWith('.png') ? { kind: 'image' } : undefined)}
  resolveImageUrl={resolveLocalImageUrl}
  onImageClick={openLightbox}
/>
```

Use `EditorHandle.revealHeading('#Section%20name')` to move the selection to a
matching heading and scroll it into view after following a heading link.

Both `MeowdownEditor` and the read-only `MarkdownView` accept
`resolveFileLink`. Return `true` to render a standard `[label](path)` Markdown
link with the same file pill, metadata resolver, and click hook used by wiki
file embeds; return `false` to keep it as a normal link.

```tsx
<MarkdownView
  markdown="[Quarterly report](docs/report.pdf)"
  resolveFileLink={({ href }) => href.startsWith('docs/')}
  resolveFileInfo={resolveLocalFileInfo}
  onFileClick={openLocalFile}
/>
```

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

### Mermaid code blocks

Fenced `mermaid` code blocks render as diagrams in both `MeowdownEditor` and
`MarkdownView`. The editor shows only the preview while the caret is outside
the block, then shows source and a live preview while editing it.

Rendering uses `beautiful-mermaid`, which currently supports Flowchart, State,
Sequence, Class, ER, and XY Chart diagrams. Unsupported syntax renders an error
instead of an empty preview. Override `--meowdown-mermaid-bg`,
`--meowdown-mermaid-fg`, or `--meowdown-mermaid-error` to customize the
diagram surface.

## Styling

Import both stylesheets: `@meowdown/core/style.css` (the editor theme and variables) and `@meowdown/react/style.css` (the component layout). The core theme is documented in [`@meowdown/core`](https://www.npmjs.com/package/@meowdown/core).

## License

MIT
