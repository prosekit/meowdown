import type { EditorView } from '@prosekit/pm/view'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { docToMarkdown } from '../../converters/pm-to-md.ts'
import { setupFixture } from '../../testing/index.ts'

/**
 * Dispatch the bare Mod-Shift-V keydown a desktop shell without a "Paste and
 * Match Style" menu item delivers: the keystroke reaches the page, but no
 * paste event follows. A synthetic event never triggers the browser's own
 * paste, so this reproduces that environment on every engine.
 */
function pressPlainPasteShortcut(view: EditorView): void {
  const isApple = /Mac|iP(?:hone|[oa]d)/.test(navigator.platform)
  const event = new KeyboardEvent('keydown', {
    key: 'V',
    code: 'KeyV',
    shiftKey: true,
    metaKey: isApple,
    ctrlKey: !isApple,
    bubbles: true,
    cancelable: true,
  })
  // prosemirror-keymap matches `Shift-` bindings through the keyCode-derived
  // base key name, and constructor-created events carry `keyCode: 0`.
  Object.defineProperty(event, 'keyCode', { value: 86 })
  view.dom.dispatchEvent(event)
}

function fireNativePlainPaste(view: EditorView, text: string): void {
  const clipboardData = new DataTransfer()
  clipboardData.setData('text/plain', text)
  const event = new ClipboardEvent('paste', { clipboardData, cancelable: true })
  // Firefox discards the DataTransfer passed to the ClipboardEvent
  // constructor; shadow the getter with the real object when it did not survive.
  if (event.clipboardData?.getData('text/plain') !== text) {
    Object.defineProperty(event, 'clipboardData', { value: clipboardData })
  }
  view.dom.dispatchEvent(event)
}

function stubClipboardReadText(text: string | Error) {
  return vi
    .spyOn(navigator.clipboard, 'readText')
    .mockImplementation(() =>
      text instanceof Error ? Promise.reject(text) : Promise.resolve(text),
    )
}

async function waitPastNativePasteWindow(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 300))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('plain paste fallback', () => {
  it('pastes the clipboard text when no native paste follows the shortcut', async () => {
    using fixture = setupFixture()
    const { n, view } = fixture
    fixture.set(n.doc(n.paragraph('a<a>b')))
    const before = docToMarkdown(view.state.doc)
    const readText = stubClipboardReadText('xxx\nyyy')

    pressPlainPasteShortcut(view)
    await vi.waitFor(() => {
      expect(docToMarkdown(view.state.doc)).not.toBe(before)
    })
    // The Shift-paste semantics: every newline run becomes a paragraph break.
    expect(docToMarkdown(view.state.doc)).toMatchInlineSnapshot(`
      """
      axxx

      yyyb

      """
    `)
    expect(readText).toHaveBeenCalledOnce()
  })

  it('stays out of the way when a native paste event follows the keydown', async () => {
    using fixture = setupFixture()
    const { n, view } = fixture
    fixture.set(n.doc(n.paragraph()))
    const readText = stubClipboardReadText('from the fallback')

    pressPlainPasteShortcut(view)
    fireNativePlainPaste(view, 'from the native paste')
    await waitPastNativePasteWindow()

    expect(docToMarkdown(view.state.doc)).toMatchInlineSnapshot(`
      """
      from the native paste

      """
    `)
    expect(readText).not.toHaveBeenCalled()
  })

  it('does not paste stale text after the document changed while waiting', async () => {
    using fixture = setupFixture()
    const { n, view } = fixture
    fixture.set(n.doc(n.paragraph('a<a>')))
    stubClipboardReadText('pasted')

    pressPlainPasteShortcut(view)
    view.dispatch(view.state.tr.insertText('typed'))
    await waitPastNativePasteWindow()

    expect(docToMarkdown(view.state.doc)).toMatchInlineSnapshot(`
      """
      atyped

      """
    `)
  })

  it('keeps the keystroke inert when the clipboard read is refused', async () => {
    using fixture = setupFixture()
    const { n, view } = fixture
    fixture.set(n.doc(n.paragraph('untouched')))
    stubClipboardReadText(new Error('denied'))

    pressPlainPasteShortcut(view)
    await waitPastNativePasteWindow()

    expect(docToMarkdown(view.state.doc)).toMatchInlineSnapshot(`
      """
      untouched

      """
    `)
  })
})
