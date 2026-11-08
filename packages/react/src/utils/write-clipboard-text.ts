/**
 * Writes `text` to the clipboard. Returns whether the write succeeded.
 */
export async function writeClipboardText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (error) {
    console.warn('[meowdown] Failed to copy:', error)
    return false
  }
}
