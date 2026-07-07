import type { Slice } from '@prosekit/pm/model'

export function getPastedText(event: ClipboardEvent, slice: Slice): string {
  const fromClipboard = event.clipboardData?.getData('text/plain')
  if (fromClipboard) return fromClipboard
  // Firefox ignores the standard `clipboardData` init member of the ClipboardEvent
  // constructor (Gecko reads non-standard `data`/`dataType` strings instead), so a
  // synthetic paste carries no text there; Chrome and WebKit honor it. Fall back to
  // the slice ProseMirror parsed from the paste, which holds the text on every engine.
  // See https://github.com/w3c/clipboard-apis/issues/33
  return slice.content.textBetween(0, slice.content.size, '\n')
}
