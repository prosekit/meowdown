const COMPOSITION_TAIL_MS = 40

let timer: ReturnType<typeof setTimeout> | undefined
let isComposing = false

if (typeof window !== 'undefined') {
  window.addEventListener(
    'compositionstart',
    () => {
      if (timer) {
        clearTimeout(timer)
        timer = undefined
      }
      isComposing = true
    },
    { capture: true, passive: true },
  )
  window.addEventListener(
    'compositionend',
    () => {
      if (!isComposing) return
      if (timer) {
        clearTimeout(timer)
      }
      timer = setTimeout(() => {
        isComposing = false
      }, COMPOSITION_TAIL_MS)
    },
    { capture: true, passive: true },
  )
}

// Workaround for WebKit firing compositionend before the keydown that commits an
// IME composition, which makes that keydown report `isComposing` as false.
// https://bugs.webkit.org/show_bug.cgi?id=165004
// https://bugs.webkit.org/show_bug.cgi?id=311717
export function getIsComposing(): boolean {
  return isComposing
}
