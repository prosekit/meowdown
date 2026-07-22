import { sleep } from '@ocavue/utils'
import { userEvent } from 'vitest/browser'

/**
 * Read the real clipboard by focusing a dummy contenteditable element and
 * pressing the native paste shortcut. The paste event's `clipboardData` is
 * readable during the event in every browser without any permission, unlike
 * `navigator.clipboard.readText()`, which WebKit rejects outside a user
 * gesture no matter which permissions are granted.
 */
export async function readClipboard(): Promise<{ html: string; text: string }> {
  const dummy = document.createElement('div')
  dummy.contentEditable = 'true'
  document.body.append(dummy)
  try {
    const result = { html: '', text: '' }
    let fired = false
    const done = new Promise<void>((resolve) => {
      dummy.addEventListener('paste', (event) => {
        event.preventDefault()
        fired = true
        result.html = event.clipboardData?.getData('text/html') ?? ''
        result.text = event.clipboardData?.getData('text/plain') ?? ''
        resolve()
      })
    })
    dummy.focus()
    await userEvent.paste()
    await Promise.race([done, sleep(2000)])
    if (!fired) {
      throw new Error('paste event never fired on the readback element')
    }
    return result
  } finally {
    dummy.remove()
  }
}

/**
 * Put arbitrary flavors on the real clipboard: select a dummy element and let
 * a copy listener replace the data during the native copy shortcut. No
 * permission needed in any browser. The copy event only fires on a DOM
 * selection, hence the selected placeholder text.
 */
export async function writeClipboard(flavors: Record<string, string>): Promise<void> {
  const dummy = document.createElement('div')
  dummy.textContent = 'placeholder'
  document.body.append(dummy)
  const selection = window.getSelection()
  try {
    let fired = false
    const done = new Promise<void>((resolve) => {
      dummy.addEventListener('copy', (event) => {
        event.preventDefault()
        fired = true
        for (const [type, value] of Object.entries(flavors)) {
          event.clipboardData?.setData(type, value)
        }
        resolve()
      })
    })
    selection?.selectAllChildren(dummy)
    await userEvent.copy()
    await Promise.race([done, sleep(2000)])
    if (!fired) {
      throw new Error('copy event never fired on the planting element')
    }
  } finally {
    selection?.removeAllRanges()
    dummy.remove()
  }
}
