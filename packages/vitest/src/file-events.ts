import type { EditorView } from '@prosekit/pm/view'

/**
 * Synthesize a paste of `files` into the view. Like `pasteFiles` from
 * `@prosekit/core/test`, but working in every browser: Firefox discards the
 * DataTransfer passed to the ClipboardEvent constructor (`event.clipboardData`
 * comes back as a different, empty DataTransfer), so when the files did not
 * survive, shadow the getter with the real object. A real-clipboard route
 * does not exist for files: every browser silently ignores `items.add(file)`
 * inside a copy listener, so a synthetic event is the only way to test file
 * pastes.
 */
export function pasteFiles(view: EditorView, files: File[]): void {
  const clipboardData = new DataTransfer()
  for (const file of files) {
    clipboardData.items.add(file)
  }
  const event = new ClipboardEvent('paste', { clipboardData })
  if (event.clipboardData?.files.length !== files.length) {
    Object.defineProperty(event, 'clipboardData', { value: clipboardData })
  }
  view.pasteHTML('<div></div>', event)
}

/**
 * Mirror of `pasteFiles` for the drop path: a synthetic `drop` event carrying
 * the files, aimed at the document position `pos`. Returns the event so tests
 * can assert whether the editor consumed it (`defaultPrevented`).
 */
export function dropFiles(view: EditorView, files: File[], pos: number): DragEvent {
  const dataTransfer = new DataTransfer()
  for (const file of files) {
    dataTransfer.items.add(file)
  }
  const coords = view.coordsAtPos(pos)
  const event = new DragEvent('drop', {
    dataTransfer,
    clientX: coords.left,
    clientY: (coords.top + coords.bottom) / 2,
    bubbles: true,
    cancelable: true,
  })
  view.dom.dispatchEvent(event)
  return event
}
