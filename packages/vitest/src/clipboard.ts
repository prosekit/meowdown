import { sleep } from '@ocavue/utils'
import { userEvent } from 'vitest/browser'

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
    // A copy event only fires on a DOM selection.
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
