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

### `<MeowdownEditor>`

The Markdown editor component. Renders inside a `div.meowdown` wrapper that fills a flex parent. In rich modes, typing `/` opens a slash menu for inserting blocks (headings, blockquote, lists, code block, table). Hovering a block shows a handle to its left: the grip selects the block and can be dragged to move it, with a drop indicator line marking the target.

- `mode?: 'focus' | 'show' | 'hide' | 'source'`: defaults to `'focus'`.
  - `'focus'`: Markdown syntax is hidden, revealed around the cursor.
  - `'show'`: Markdown syntax is always visible.
  - `'hide'`: Markdown syntax is always hidden.
  - `'source'`: raw Markdown source with syntax highlighting.
- `initialMarkdown?: string`: first render only.
- `onDocChange?: VoidFunction`: called on every user-driven document change. Programmatic `setMarkdown` / `setState` on the handle do not fire it.
- `onTagSearch?: (query: string) => TagItem[] | Promise<TagItem[]>`: enables the tag menu, which opens when typing `#` followed by text in a rich mode. Returns ranked rows `{ tag, label?, detail?, onSelect? }` (the menu does not re-sort). Selecting a row inserts `#tag ` then runs its `onSelect`. Omit to disable.
- `onWikilinkSearch?: (query: string) => WikilinkItem[] | Promise<WikilinkItem[]>`: enables the wikilink menu, which opens as soon as `[[` or `@` is typed, or `Mod-Shift-k` is pressed, in a rich mode; the shortcut seeds the query from any selected text. Returns ranked rows `{ target, label?, detail?, onSelect? }` (the menu does not re-sort). Selecting a row inserts `[[target]]` then runs its `onSelect`. Omit to disable.
- `onWikilinkClick?: (payload: { target: string; event: MouseEvent }) => void`: called when a rendered wiki link is clicked. A plain click inside a link the caret already sits in just places the caret; `Mod`-click always fires. Pass a stable function (e.g. from `useCallback`). Ignored in source mode.
- `onLinkClick?: (payload: { href: string; event: MouseEvent }) => void`: called with its `href` when a rendered Markdown link (`[text](url)`) is clicked. A plain click inside a link the caret already sits in just places the caret; `Mod`-click always fires. Pass a stable function (e.g. from `useCallback`). Ignored in source mode.
- `resolveImageUrl?: (src: string) => string | undefined`: maps an image `src` to a displayable URL (or `undefined` to skip). Enables inline image rendering: `![alt](src)` stays literal text and the image renders beneath its line. Pass a stable function. Ignored in source mode.
- `onImagePaste?: (file: File) => string | undefined | Promise<string | undefined>`: persists a pasted or dropped image file and returns its markdown `src` (or `undefined` to decline), synchronously or as a promise. Pass a stable function. Ignored in source mode.
- `onImageSaveError?: (error: unknown, file: File) => void`: called when `onImagePaste` throws. Defaults to `console.error`. Ignored in source mode.
- `onImageClick?: (payload: { src: string; alt: string; event: MouseEvent }) => void`: called when a rendered image is clicked, with its markdown `src`, `alt`, and the originating `MouseEvent`. Pass a stable function (e.g. from `useCallback`). Ignored in source mode.
- `embedPaste?: boolean`: auto-embeds a pasted tweet or YouTube link as a rich embed; one undo turns the embed back into the raw link. On by default; set `false` to disable. Only takes effect when `resolveImageUrl` is set, since embeds render through the image pipeline. Ignored in source mode.
- `bulletAfterHeading?: boolean`: pressing Enter at the end of the document's first heading (the title line) starts a fresh empty bullet on the next line instead of a plain paragraph. Off by default. Ignored in source mode.
- `blockHandle?: boolean`: shows the per-block gutter handle in the rich modes (a drag grip for reordering blocks, plus the drop indicator). On by default; set `false` to hide the gutter affordance entirely, e.g. when the host does not want block reordering. Ignored in source mode and when `readOnly` is set.
- `placeholder?: string | ((state) => string)`: placeholder text shown when the whole document is empty. Pass a stable function. Ignored in source mode.
- `readOnly?: boolean`: makes the editor read-only, in both the rich and source modes.
- `spellCheck?: boolean`: toggles the browser's native spell checking in the rich modes. Defaults to the browser's behavior. Ignored in source mode.
- `editorClassName?: string`: class on the editable root (the contenteditable). Rich modes only.
- `wrapperClassName?: string`: class on the outer `div.meowdown` wrapper.
- `handleRef?: Ref<EditorHandle>`
- `children?: ReactNode`: rendered inside the editor's ProseKit context, so children can call `useEditor()`. Only rendered in the rich modes; source mode ignores them.

### `<MarkdownView>`

A read-only renderer that turns Markdown into a React tree styled exactly like `<MeowdownEditor>` in `hide` mode: inline marks, wiki-link chips, images, tweet/YouTube embeds, and syntax-highlighted code. It mounts no editor and holds no ProseMirror view, so it is cheap to render many times (backlink lists, search results, previews). Import `@meowdown/core/style.css` for the theme; the root carries the `ProseMirror` and `meowdown-content` classes plus `data-mark-mode`, so the editor stylesheet applies unchanged.

```tsx
import '@meowdown/core/style.css'
import { MarkdownView } from '@meowdown/react'
;<MarkdownView
  markdown="See [[Some Note]] and **bold**."
  onWikilinkClick={({ target }) => open(target)}
/>
```

- `markdown: string`: the Markdown to render. Live: changing it re-renders.
- `markMode?: 'hide' | 'focus' | 'show'`: defaults to `'hide'`.
- `frontmatter?: boolean`: peel a leading YAML frontmatter block first. Off by default.
- `resolveImageUrl?`, `onWikilinkClick?`, `onLinkClick?`, `onImageClick?`: the same shapes as the matching `<MeowdownEditor>` props. Pass stable functions.
- `className?: string`: extra class on the content root.

Code blocks render their content and syntax highlighting (the same `tok-*` classes as the editor) but without the editor's language picker / copy toolbar. `<MarkdownView>` requires a DOM environment; it is not a server-side HTML-string renderer.

### `useEditor`

Re-exported from `@prosekit/react`. Call it from a component passed as `children` to read the live editor instance.

### `useKeymap`

Re-exported from `@prosekit/react`. Registers a keymap on the editor from a `children` component; set its priority with `Priority` from `@meowdown/core`.

### `useExtension`

Re-exported from `@prosekit/react`. Applies an extension to the editor from a `children` component.

### `EditorHandle`

Imperative handle for the editor, attached via `handleRef`.

- `getMarkdown(): string`: serializes the current document to Markdown. Can be expensive on large documents; call it on demand (e.g. throttled) instead of on every change.
- `setMarkdown(markdown: string): void`: replaces the whole document as a single undoable edit. Does not fire `onDocChange`.
- `getState(): EditorStateSnapshot`: returns `[markdown, selection]`, where `selection` is a `SelectionJSON` (`{ anchor: number, head: number, type: string }`).
- `setState(markdown?: string, selection?: SelectionJSON | 'start' | 'end'): void`: replaces the document (if `markdown` is given) and restores `selection`: exactly when valid, otherwise clamped to the nearest text selection; out-of-range positions never throw. `'start'` and `'end'` jump to the document edges. Without a selection, the current one is mapped through the change. Restore a snapshot with `handle.setState(...handle.getState())`.
- `getSelection(): SelectionJSON`: returns the current selection.
- `setSelection(selection: SelectionJSON | 'start' | 'end'): void`: restores a selection with the same hint semantics as `setState`.
- `focus(): void`: focuses the editor.
- `scrollIntoView(): void`: scrolls the selection into view.
- `editor: TypedEditor | undefined`: escape hatch for the underlying ProseKit editor, `undefined` in source mode. No stability guarantees beyond what `@meowdown/core` exports.

Selection positions are in the mounted editor's coordinate space: ProseMirror document positions in the rich modes, character offsets in source mode. They round-trip within one mode but are not portable across a mode switch.

## Styling

Import both stylesheets: `@meowdown/core/style.css` (the editor theme and variables) and `@meowdown/react/style.css` (the component layout). The core theme is documented in [`@meowdown/core`](https://www.npmjs.com/package/@meowdown/core).

## License

MIT
