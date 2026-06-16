import type { EditorView } from '@prosekit/pm/view'

/** Dispatch a synthetic `paste` carrying `text` as `text/plain` onto the view. */
export function pasteText(view: EditorView, text: string): void {
  const clipboardData = new DataTransfer()
  clipboardData.setData('text/plain', text)
  view.dom.dispatchEvent(
    new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }),
  )
}
